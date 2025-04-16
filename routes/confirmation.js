const express = require('express');
router = express.Router();
const common = require("openfsm-common"); /* Библиотека с общими параметрами */
const authMiddleware = require('openfsm-middlewares-auth-service'); // middleware для проверки токена
const confirmation = require('../controllers/confirmationController');


router.post('/v1/code', authMiddleware.authenticateToken, confirmation.sendCode);    // отправить код на проверку
router.post('/v1/request', authMiddleware.authenticateToken, confirmation.sendRequest);    // Создать заказ на код
router.post('/v1/2pa-request', authMiddleware.authenticateToken, confirmation.create2PARequestId);    // Создать запрос на смену кода
router.get('/v1/2pa-request/:confirmationType', authMiddleware.authenticateToken, confirmation.get2PARequestId);    // Получить активный запрос 2pa-question || digital-code


module.exports = router;
