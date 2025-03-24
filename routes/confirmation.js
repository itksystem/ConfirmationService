const express = require('express');
router = express.Router();
const common = require("openfsm-common"); /* Библиотека с общими параметрами */
const authMiddleware = require('openfsm-middlewares-auth-service'); // middleware для проверки токена
const confirmation = require('../controllers/confirmationController');


router.post('/v1/code', authMiddleware.authenticateToken, confirmation.sendCode);    // отправить код на проверку
router.post('/v1/request', authMiddleware.authenticateToken, confirmation.sendRequest);    // Создать заказ на код


module.exports = router;
