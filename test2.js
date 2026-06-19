const http = require('http');
const PORT = 9527;

http.get(`http://localhost:${PORT}/`, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
        console.log('状态码:', res.statusCode);
        console.log('Content-Type:', res.headers['content-type']);
        console.log('内容前300字:', body.substring(0, 300));
    });
}).on('error', (e) => {
    console.log('请求失败:', e.message);
});
