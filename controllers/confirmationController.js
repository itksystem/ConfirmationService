const confirmationHelper = require('../helpers/ConfirmationHelper');
const sendResponse = (res, statusCode, data) => {
    res.status(statusCode).json(data);
};


exports.sendCode = async (req, res) => {        
    try {        
        const {orderId, date, deliveryType} = req.body;
        if (!orderId || !date || !deliveryType ) throw(400);        
        const deliveryId = await deliveryHelper.create(orderId, date, deliveryType);        
        if(!deliveryId) throw(422)
        sendResponse(res, 200, { status: true, deliveryId });
    } catch (error) {
         console.error("Error create:", error);
         sendResponse(res, (Number(error) || 500), { code: (Number(error) || 500), message:  new CommonFunctionHelper().getDescriptionByCode((Number(error) || 500)) });
    }
};

