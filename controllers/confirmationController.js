const confirmationHelper = require('../helpers/ConfirmationHelper');
const CommonFunctionHelper = require("openfsm-common-functions")
const commonFunction= new CommonFunctionHelper();
const authMiddleware = require('openfsm-middlewares-auth-service'); // middleware для проверки токена
const ClientServiceHandler = require("openfsm-client-service-handler");
const clientService = new ClientServiceHandler();              // интерфейс для  связи с MC AuthService


const sendResponse = (res, statusCode, data) => {
    res.status(statusCode).json(data);
};


exports.sendCode = async (req, res) => {        
    try {        
        const {requestId} = req.body;
        if (!requestId) throw(400);        
        const deliveryId = await confirmationHelper.sendCode(orderId, date, deliveryType);        
        if(!deliveryId) throw(422)
        sendResponse(res, 200, { status: true, deliveryId });
    } catch (error) {
         console.error("Error create:", error);
         sendResponse(res, (Number(error) || 500), { code: (Number(error) || 500), message:  new CommonFunctionHelper().getDescriptionByCode((Number(error) || 500)) });
    }
};


exports.sendRequest = async (req, res) => {        
    try {        
        let userId = await authMiddleware.getUserId(req, res);
        if(!userId) throw(401);      
        let {confirmationType} = req.body;
        if(!confirmationType) throw(402);      
        let _profile = await clientService.profile(req,res);
        if(!_profile?.data?.profile?.phone) throw(402)

        const hasConfirmActiveRequestId = await confirmationHelper.hasConfirmActiveRequestId(userId);        
        if(hasConfirmActiveRequestId == true ) 
            throw(429); // отказываем в создании запроса - есть активные запросы не просроченные 
        const requestId = await confirmationHelper.createConfirmCode(userId, confirmationType);        
        if(!requestId) throw(422)
        let result = await confirmationHelper.sendCodeToESB(requestId, _profile?.data?.profile);
        if(!result) throw(500)                         
        sendResponse(res, 200, { status: true, requestId });
    } catch (error) {
         console.error("Error create:", error);
         sendResponse(res, (Number(error) || 500), { code: (Number(error) || 500), message:  new CommonFunctionHelper().getDescriptionByCode((Number(error) || 500)) });
    }
};
