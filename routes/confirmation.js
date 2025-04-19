const express = require('express');
router = express.Router();
const common = require("openfsm-common"); /* Библиотека с общими параметрами */
const authMiddleware = require('openfsm-middlewares-auth-service'); // middleware для проверки токена
const confirmation = require('../controllers/confirmationController');

// отправить код на проверку  request {code, requestId}
router.post('/v1/check-code', authMiddleware.authenticateToken, confirmation.checkCode);    

// отправка кода по запрашиваемому каналу на подтверждение request{confirmationType = email||phone}
router.post('/v1/send-code-request', authMiddleware.authenticateToken, confirmation.sendRequest);              

// Запросить создание нового активного запроса на подтверждение request{requestType=security-question || pin-code }, отменив старые
router.post('/v1/request', authMiddleware.authenticateToken, confirmation.createRequestId);    

// Получить активный запрос request{requestType = security-question || pin-code }
router.get( '/v1/request/:confirmationType', authMiddleware.authenticateToken, confirmation.getRequestId);    


module.exports = router;
 