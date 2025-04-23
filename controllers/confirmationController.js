const confirmationHelper = require('../helpers/ConfirmationHelper');
const CommonFunctionHelper = require("openfsm-common-functions")
const commonFunction= new CommonFunctionHelper();
const authMiddleware = require('openfsm-middlewares-auth-service'); // middleware для проверки токена
const ClientServiceHandler = require("openfsm-client-service-handler");
const clientService = new ClientServiceHandler();              // интерфейс для  связи с MC AuthService
const bcrypt = require('bcryptjs');


const sendResponse = (res, statusCode, data) => {
    res.status(statusCode).json(data);
};


exports.checkCode = async (req, res) => {
    let request = null;
    const { requestId, code, action, pinCode } = req.body; // Получаем requestId и код из тела запроса
    let userId = await authMiddleware.getUserId(req, res);
    if(!userId) throw(401);      
    try {
        // 1. Валидация входных данных
        if (!requestId || !code || !action) {
            throw new Error('400');
        }

        // 2. Получаем данные запроса
        request = await confirmationHelper.getRequestData(requestId);
        if (!request.user_id || (request.user_id != userId)) {
            throw new Error('500');
        }

        // 3. Проверка лимита попыток и статуса
        if (request.attempts >= 3 || request.status === 'SUCCESS') {
            throw new Error('429');
        }

        // 4. Проверка актуальности requestId
        const isActiveRequestId = await confirmationHelper.isActiveRequestId(requestId);
        if (!isActiveRequestId) {
            throw new Error('422');
        }

        // 5. Проверка кода
        if (Number(request?.code) !== Number(code)) {
            if (request.attempts >= 2 ) throw new Error('429');            
            throw new Error('400');
        } else {
            // 5.1 Успешная проверка кода
            const setStatus = await confirmationHelper.setRequestStatus(requestId, 'SUCCESS');
            if (!setStatus) {
                throw new Error('500');
            }
            switch(action){
              case 'PIN_CODE_ENABLE' : {
                if (!pinCode) {
                    throw new Error('500');
                }
                let sendResult = await confirmationHelper.sendPINCodeStatusResultToBus(requestId, action, pinCode);
                if (!sendResult) {
                    throw new Error('500');
                }
                break;
              }     
              case 'PIN_CODE_DISABLE' : {
                let sendResult = await confirmationHelper.sendPINCodeStatusResultToBus(requestId, action);
                if (!sendResult) {
                    throw new Error('500');
                }
                break;
              }     
              case '____PIN_CODE_ENABLE' : {
                // 5.2 Отправка результата в шину
                const sendResult = await confirmationHelper.sendVerificationResultToBus(requestId);
                if (!sendResult) {
                    throw new Error('500');
                }
                break;                
              }
            }           
            // 5.3 Успешный ответ
            sendResponse(res, 200, { status: true, requestId, message: 'Код подтвержден!' });
        } 
    } catch (error) {
        console.error('Error in sendCode:', error);

        // 7. Обработка ошибок
        let statusCode = Number(error.message) || 500;
        let responseData;

        // 7.1 Установка статуса FAILED при ошибке        
        await confirmationHelper.setRequestStatus(requestId, 'FAILED');        

        // 7.2 Формирование ответа в зависимости от типа ошибки
        switch (statusCode) {
            case 429:
                responseData = {
                    code: 429,
                    message: 'Исчерпаны попытки ввода кода'
                };
                break;
            case 422:
                responseData = {
                    code: 422,
                    message: 'Запрос устарел'
                };
                break;
            case 400:
                responseData = {
                    code: 400,
                    message: `Неверный код. Повторите попытку (${request?.attempts+1|| 0}/3).`
                };
                break;
            default:
                responseData = {
                    code: statusCode,
                    message: new CommonFunctionHelper().getDescriptionByCode(statusCode)
                };
        }

        // 7.3 Отправка ответа с ошибкой
        sendResponse(res, statusCode, responseData);
    }
};

exports.sendRequest = async (req, res) => {        
    try {        
        let userId = await authMiddleware.getUserId(req, res);
        if(!userId) throw(401);      
        let {confirmationType} = req.body;
        if(!confirmationType) throw(402); 
        let {requestId} = req.body;     
        if(!requestId) throw(402);      
        let _profile = await clientService.profile(req,res);
        if(!_profile?.data?.profile?.phone) throw(402)                
            switch(confirmationType){
                case 'phone' : {
                    let result = await confirmationHelper.sendVerificationCodeToBus(requestId, _profile?.data?.profile);
                    if(!result) throw(500)                         
                    break   
                }
                case 'email' : {
                    let result = await confirmationHelper.sendVerificationEmailCodeToBus(requestId, _profile?.data?.profile);
                    if(!result) throw(500)                         
                    break   
                }
        }        
        sendResponse(res, 200, { status: true, requestId });
    } catch (error) {
         console.error("Error create:", error);
         sendResponse(res, (Number(error) || 500), { 
            code: (Number(error) || 500),
            message:  new CommonFunctionHelper().getDescriptionByCode((Number(error) || 500)) 
        });
    }
};

/*
exports.createRequestId = async (req, res) => {        
    try {        
        let userId = await authMiddleware.getUserId(req, res);
        if(!userId) throw(401);      
        let {requestType} = req.body; // security-question || pin-code
        if(!requestType) throw(402);      
        
        await confirmationHelper.disable2PHARequestId(userId, requestType);
        const requestId = await confirmationHelper.createConfirmCode(userId, requestType);
        if(!requestId) throw(429); // отказываем в создании запроса - есть активные запросы не просроченные                

        sendResponse(res, 200, { status: true, requestId });
    } catch (error) {
         console.error("Error create:", error);
         sendResponse(res, (Number(error) || 500), { 
            code: (Number(error) || 500),
            message:  new CommonFunctionHelper().getDescriptionByCode((Number(error) || 500)) 
        });
    }
};

*/
// создаем запрос на тип подтверждения  email || phone
exports.createRequestId = async (req, res) => {        
    try {        
        let userId = await authMiddleware.getUserId(req, res);
        if(!userId) throw(401);      
        let {confirmationType} = req.body; // email || phone
        if(!confirmationType) throw(402);      
               
        const requestId = await confirmationHelper.createConfirmCode(userId, confirmationType);
        if(!requestId) throw(429); // отказываем в создании запроса - есть активные запросы не просроченные                

        sendResponse(res, 200, { status: true, requestId });
    } catch (error) {
         console.error("Error create:", error);
         sendResponse(res, (Number(error) || 500), { 
            code: (Number(error) || 500),
            message:  new CommonFunctionHelper().getDescriptionByCode((Number(error) || 500)) 
        });
    }
};


exports.getRequestId = async (req, res) => {        
    try {        
        let userId = await authMiddleware.getUserId(req, res);
        if(!userId) throw(401);      
        let requestType = req.params.confirmationType; // security-question || pin-code        
        if(!requestType) throw(402);              
        console.log(userId, requestType);
        const request = await confirmationHelper.get2PHARequestId(userId, requestType);
        sendResponse(res, 200, { status: request?.requestId ? true : false, requestId : request ? request.requestId : undefined });
    } catch (error) {
         console.error("Error create:", error);
         sendResponse(res, (Number(error) || 500), { 
            code: (Number(error) || 500),
            message:  new CommonFunctionHelper().getDescriptionByCode((Number(error) || 500)) 
        });
    }
};

exports.getSecurityQuestionStatus = async (req, res) => {
    try {    
      let userId = await authMiddleware.getUserId(req, res);
      if (!userId) throw(401);  
      const factor = await confirmationHelper.getSecurityQuestionStatus(userId);    
      res.status(200).json({ status: (factor?.factor_key ? true : false) }); // Успешный ответ
    } catch (error) {      
      sendResponse(res, (Number(error) || 500), { 
        code: (Number(error) || 500),
        message:  new CommonFunctionHelper().getDescriptionByCode((Number(error) || 500)) 
    });
    }
  };

  exports.getSecurityQuestions = async (req, res) => {
    try {    
      let userId = await authMiddleware.getUserId(req, res);
      if (!userId) throw(401)
      const questions = await confirmationHelper.getSecurityQuestions();    
      if (!questions) throw(500)
      res.status(200).json({ status: true, questions }); // Успешный ответ
    } catch (error) {      
      sendResponse(res, (Number(error) || 500), { 
        code: (Number(error) || 500),
        message:  new CommonFunctionHelper().getDescriptionByCode((Number(error) || 500)) 
    });
    }
  };


  exports.setSecurityQuestion = async (req, res) => {   
    let userId = await authMiddleware.getUserId(req, res);
    const {factorId, factorText, answerText, requestId} = req.body;
    console.log(req.body)
    try {    
      if (!userId) throw(401)
      if (!answerText || !requestId) throw(402)
      if(!factorId && (!factorText || factorText=='')) throw(402)

       const request = await confirmationHelper.getRequestData(requestId);      
       console.log(request);
       if(!request?.request_id || request?.attempts >= 3 ) throw(422)
              
        const factorHash = await bcrypt.hash(answerText.trim().toLowerCase(), 10);
        const result = await confirmationHelper.setSecurityQuestion(userId, factorId, factorText, factorHash);              
        const status = result ? `SUCCESS`  : `ERROR`;
        const result2 = await confirmationHelper.setRequestStatus(requestId, status)        
        if (!result) throw(500)
        
        res.status(200).json({ status: true }); // Успешный ответ
      } catch (error) {    
        console.log(error);
        sendResponse(res, (Number(error) || 500), { 
            code: (Number(error) || 500),
            message:  new CommonFunctionHelper().getDescriptionByCode((Number(error) || 500)) 
        });
      }    
  };

// получить контрольный вопрос
exports.getSecurityQuestion = async (req, res) => {
    try {    
      let userId = await authMiddleware.getUserId(req, res);
      if (!userId) throw(401)
      const question = await confirmationHelper.getSecurityQuestion(userId);    
      res.status(200).json({ status: (question?.text ? true : false), question }); // Успешный ответ
    } catch (error) {
        console.log(error);
        sendResponse(res, (Number(error) || 500), { 
            code: (Number(error) || 500),
            message:  new CommonFunctionHelper().getDescriptionByCode((Number(error) || 500)) 
        });
    }
  };

  //  Проверка кода и выполнение операции DISABLE_SECURITY_QUESTION, ENABLE_SECURITY_QUESTION
exports.securityQuestionAnswer = async (req, res) => {
    let userId = await authMiddleware.getUserId(req, res);
    const {answer, requestId, action} = req.body;  
    try {    
      if (!userId) throw(401)
      if(!answer || !requestId || !action) throw(422)
  
      const factor = await confirmationHelper.getSecurityAnswer(userId);    
      const isMatch = await bcrypt.compare(answer.trim().toLowerCase(), factor.factor_key); // сравниваем     
      if (!isMatch)  throw(422);
  
      switch(action){
         case 'DISABLE_SECURITY_QUESTION' : {
          let securityQuestionResult  = await confirmationHelper.disableSecurityQuestion(userId);
          let requestIdResult = await confirmationHelper.change2PHARequestId({userId, requestId, action} )          
          if(!securityQuestionResult?.blocked) throw(422);
           break;
        }
      }    
         res.status( (isMatch ? 200 : 403)).json({ status: isMatch }); // Успешный ответ    
    } catch (error) {
        response.error(req, res, error); 
    }
  };
  