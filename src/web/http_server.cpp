#include "web/http_server.h"
#include "common/logger.h"
#include <sstream>
#include <fstream>
#include <filesystem>
#include <algorithm>

namespace dfs {

std::string HttpResponse::serialize() const {
    std::ostringstream ss;
    std::string reason = "OK";
    if (status_code == 204) reason = "No Content";
    else if (status_code == 404) reason = "Not Found";
    else if (status_code == 400) reason = "Bad Request";
    else if (status_code == 403) reason = "Forbidden";
    else if (status_code == 500) reason = "Internal Server Error";

    ss << "HTTP/1.1 " << status_code << " " << reason << "\r\n";
    ss << "Content-Type: " << content_type << "\r\n";
    ss << "Content-Length: " << body.size() << "\r\n";
    ss << "Access-Control-Allow-Origin: *\r\n";
    ss << "Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS\r\n";
    ss << "Access-Control-Allow-Headers: Content-Type, Authorization\r\n";
    ss << "Connection: close\r\n";

    for (const auto& [k, v] : headers) {
        ss << k << ": " << v << "\r\n";
    }
    ss << "\r\n";
    ss << body;
    return ss.str();
}

HttpServer::HttpServer(int port, const std::string& static_root_dir)
    : port_(port), static_root_(static_root_dir) {}

HttpServer::~HttpServer() { stop(); }

bool HttpServer::start() {
    tcp_server_ = std::make_unique<TcpServer>();
    tcp_server_->setConnectionHandler([this](SOCKET sock, const std::string& ip, int client_port) {
        handleSocket(sock, ip, client_port);
    });
    if (!tcp_server_->start(port_)) {
        LOG_ERROR("HttpServer", "Failed to start HTTP server on port " + std::to_string(port_));
        return false;
    }
    LOG_INFO("HttpServer", "Dashboard & REST API server online at http://127.0.0.1:" + std::to_string(port_) + "/");
    return true;
}

void HttpServer::stop() { if (tcp_server_) tcp_server_->stop(); }
bool HttpServer::isRunning() const { return tcp_server_ && tcp_server_->isRunning(); }

void HttpServer::registerRoute(const std::string& method, const std::string& path, HttpHandler handler) {
    std::lock_guard<std::mutex> lock(routes_mutex_);
    routes_[method + ":" + path] = std::move(handler);
}

// ── parseRequest: extract headers only from initial buffer ────────────────────
HttpRequest HttpServer::parseRequest(const std::string& raw, const std::string& client_ip) {
    HttpRequest req;
    req.client_ip = client_ip;

    std::istringstream stream(raw);
    std::string line;
    if (std::getline(stream, line)) {
        if (!line.empty() && line.back() == '\r') line.pop_back();
        std::istringstream ls(line);
        ls >> req.method >> req.path;

        size_t q = req.path.find('?');
        if (q != std::string::npos) {
            req.query_string = req.path.substr(q + 1);
            req.path = req.path.substr(0, q);
            std::istringstream qs(req.query_string);
            std::string pair;
            while (std::getline(qs, pair, '&')) {
                size_t eq = pair.find('=');
                if (eq != std::string::npos)
                    req.query_params[pair.substr(0, eq)] = pair.substr(eq + 1);
                else if (!pair.empty())
                    req.query_params[pair] = "";
            }
        }
    }

    while (std::getline(stream, line) && line != "\r" && !line.empty()) {
        if (!line.empty() && line.back() == '\r') line.pop_back();
        size_t col = line.find(':');
        if (col != std::string::npos) {
            std::string key = line.substr(0, col);
            std::string val = line.substr(col + 1);
            while (!val.empty() && val.front() == ' ') val.erase(val.begin());
            req.headers[key] = val;
        }
    }

    // Body = whatever came after headers in the initial recv
    std::ostringstream bss;
    bss << stream.rdbuf();
    req.body = bss.str();
    return req;
}

HttpResponse HttpServer::serveStaticFile(const std::string& req_path) {
    HttpResponse resp;
    std::string path = (req_path == "/" || req_path.empty()) ? "/index.html" : req_path;
    std::string full_path = static_root_ + path;

    if (!std::filesystem::exists(full_path) || std::filesystem::is_directory(full_path)) {
        resp.status_code = 404; resp.content_type = "text/plain"; resp.body = "404 Not Found";
        return resp;
    }

    std::ifstream file(full_path, std::ios::binary);
    if (!file) {
        resp.status_code = 500; resp.content_type = "text/plain"; resp.body = "Error opening file";
        return resp;
    }

    std::ostringstream ss; ss << file.rdbuf();
    resp.body = ss.str(); resp.status_code = 200;
    if      (full_path.ends_with(".html")) resp.content_type = "text/html; charset=utf-8";
    else if (full_path.ends_with(".css"))  resp.content_type = "text/css; charset=utf-8";
    else if (full_path.ends_with(".js"))   resp.content_type = "application/javascript; charset=utf-8";
    else if (full_path.ends_with(".json")) resp.content_type = "application/json";
    else if (full_path.ends_with(".svg"))  resp.content_type = "image/svg+xml";
    else resp.content_type = "text/plain";
    return resp;
}

// ── handleSocket: read full HTTP request including complete body ───────────────
void HttpServer::handleSocket(SOCKET sock, const std::string& ip, int port) {
    // ── Step 1: read until end of HTTP headers (\r\n\r\n) ────────────────────
    std::string raw;
    raw.reserve(8192);
    char tmp[4096];
    size_t header_end = std::string::npos;

    // Set a receive timeout so we don't hang forever
    DWORD recv_timeout = 15000; // 15 seconds
    setsockopt(sock, SOL_SOCKET, SO_RCVTIMEO, (const char*)&recv_timeout, sizeof(recv_timeout));

    while (header_end == std::string::npos) {
        int n = recv(sock, tmp, sizeof(tmp), 0);
        if (n <= 0) return; // connection closed or error
        raw.append(tmp, n);
        header_end = raw.find("\r\n\r\n");
        if (raw.size() > 4 * 1024 * 1024) return; // safety: abort if headers > 4MB
    }

    // ── Step 2: parse headers to get Content-Length ──────────────────────────
    HttpRequest req = parseRequest(raw, ip);

    // CORS preflight
    if (req.method == "OPTIONS") {
        HttpResponse opt;
        opt.status_code = 204; opt.body = "";
        std::string out = opt.serialize();
        SocketUtil::sendExact(sock, out.data(), out.size());
        return;
    }

    // ── Step 3: read remaining body bytes if Content-Length > already received ─
    size_t headers_block_end = header_end + 4; // position after \r\n\r\n
    std::string body_so_far = raw.substr(headers_block_end);

    size_t content_length = 0;
    auto cl_it = req.headers.find("Content-Length");
    if (cl_it != req.headers.end()) {
        try { content_length = std::stoull(cl_it->second); } catch (...) { content_length = 0; }
    }

    // Enforce a 50 MB request body limit
    const size_t MAX_BODY = 50ULL * 1024 * 1024;
    if (content_length > MAX_BODY) {
        HttpResponse err;
        err.status_code = 413;
        err.body = "{\"error\":\"Request body too large (max 50MB)\"}";
        std::string out = err.serialize();
        SocketUtil::sendExact(sock, out.data(), out.size());
        return;
    }

    // Keep reading until we have the full body
    while (body_so_far.size() < content_length) {
        size_t needed = content_length - body_so_far.size();
        size_t to_read = std::min(needed, (size_t)sizeof(tmp));
        int n = recv(sock, tmp, (int)to_read, 0);
        if (n <= 0) break; // connection closed before full body — process what we have
        body_so_far.append(tmp, n);
    }

    req.body = std::move(body_so_far);

    // ── Step 4: dispatch to registered route ─────────────────────────────────
    HttpResponse resp;
    HttpHandler handler = nullptr;
    {
        std::lock_guard<std::mutex> lock(routes_mutex_);
        auto it = routes_.find(req.method + ":" + req.path);
        if (it != routes_.end()) handler = it->second;
    }

    if (handler) {
        try {
            resp = handler(req);
        } catch (const std::exception& ex) {
            resp.status_code = 500;
            resp.body = "{\"error\":\"Handler exception: " + std::string(ex.what()) + "\"}";
        }
    } else {
        resp = serveStaticFile(req.path);
    }

    std::string out = resp.serialize();
    SocketUtil::sendExact(sock, out.data(), out.size());
}

} // namespace dfs
