const express = require('express');
const multer = require('multer');
const fs = require('fs');
const axios = require('axios');
const path = require('path');
const FormData = require('form-data');
const bodyParser = require('body-parser');

const app = express();
const port = 3000;

// Flask 서버 URL 설정
const FLASK_SERVER_URL = 'https://port-0-kpass-flask-m0rc2yaj6eba411b.sel4.cloudtype.app/';  // 실제 Flask 서버 URL로 교체할 것

// 차단할 도메인 리스트
const BLOCKED_DOMAINS = ['malicious.com', 'phishing.com'];

// JSON 요청 본문을 파싱하는 미들웨어
app.use(express.json());
app.use(bodyParser.json());

// 파일 업로드를 처리하는 미들웨어
const upload = multer({ dest: 'uploads/' });

// 간단한 HelloWorld 엔드포인트 추가
app.get('/hello', (req, res) => {
  res.send('Hello, World!');
});

// 네트워크 모니터링: URL이 차단되었는지 확인
app.post('/check-url', (req, res) => {
  const { url } = req.body;

  try {
    const domain = new URL(url).hostname;

    if (BLOCKED_DOMAINS.includes(domain)) {
      res.json({ blocked: true, message: `차단된 도메인: ${domain}` });
    } else {
      res.json({ blocked: false, message: `접속 허용: ${domain}` });
    }
  } catch (error) {
    res.status(400).json({ error: '유효하지 않은 URL입니다.' });
  }
});

// 미들웨어: 모든 요청에서 차단된 도메인으로의 요청을 차단
app.use((req, res, next) => {
  const requestUrl = req.headers['x-request-url'];
  if (requestUrl) {
    try {
      const domain = new URL(requestUrl).hostname;

      if (BLOCKED_DOMAINS.includes(domain)) {
        console.log(`차단된 도메인(${domain})으로의 요청이 차단되었습니다.`);
        return res.status(403).send('이 도메인에 대한 접근이 차단되었습니다.');
      }
    } catch (error) {
      console.error('요청 URL 검사 중 오류 발생:', error);
    }
  }
  next();
});

// 이미지 업로드 및 처리
app.post('/upload', upload.single('image'), async (req, res) => {
  try {
    const imagePath = path.join(__dirname, req.file.path);
    const image = fs.createReadStream(imagePath);

    // FormData 인스턴스 생성
    const form = new FormData();
    form.append('image', image);

    // Flask 서버로 이미지 전송
    const response = await axios.post(`${FLASK_SERVER_URL}/analyze`, form, {
      headers: {
        ...form.getHeaders(),
      },
    });

    fs.unlinkSync(imagePath); // 처리 후 이미지 파일 삭제

    res.json(response.data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '이미지 처리 중 오류 발생' });
  }
});

// 메시지 분석: 메시지를 받아 Flask 서버로 전달
app.post('/api/receive-message', async (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: '메시지가 제공되지 않았습니다.' });
  }

  try {
    // 메시지를 Flask 서버로 전달
    const flaskResponse = await axios.post(`${FLASK_SERVER_URL}/predict`, { text: message });

    // Flask 서버의 응답을 클라이언트에게 전달
    res.json(flaskResponse.data);
  } catch (error) {
    console.error('Flask 서버와의 통신 중 오류 발생:', error);
    res.status(500).json({ error: 'Flask 서버로 메시지 전달 중 오류 발생' });
  }
});

// 서버 시작
app.listen(port, () => {
  console.log(`서버가 http://localhost:${port}에서 실행 중입니다.`);
});
