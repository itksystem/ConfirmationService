const express = require('express');
router = express.Router();
const common = require("openfsm-common"); /* Библиотека с общими параметрами */
const authMiddleware = require('openfsm-middlewares-auth-service'); // middleware для проверки токена
const confirmation = require('../controllers/confirmationController');


router.post('/v1/sendCode', authMiddleware.authenticateToken, confirmation.sendCode);    // Создать заказ на доставку 


module.exports = router;
