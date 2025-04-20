const db = require('openfsm-database-connection-producer');
const common      = require('openfsm-common');  /* Библиотека с общими параметрами */
const SQL        = require('common-confirmation-service').SQL;
const MESSAGES   = require('common-confirmation-service').MESSAGES;
const logger     = require('openfsm-logger-handler');

require('dotenv').config({ path: '.env-confirmation-service' });
const ClientProducerAMQP  =  require('openfsm-client-producer-amqp'); // ходим в почту через шину
const amqp = require('amqplib');


/* Коннектор для шины RabbitMQ */
const { RABBITMQ_HOST, RABBITMQ_PORT, RABBITMQ_USER, RABBITMQ_PASSWORD, RABBITMQ_EMAIL_CODES_QUEUE,  
  RABBITMQ_SMS_CODES_QUEUE, RABBITMQ_SMS_CODES_RESULT_QUEUE, RABBITMQ_SMS_CODES_RESULT_SUCCESS_CALLBACK_QUEUE,
  RABBITMQ_CHANGE_PIN_CODE_QUEUE, RABBITMQ_TWO_PA_CHANGE_STATUS_QUEUE } = process.env;
const login = RABBITMQ_USER || 'guest';
const pwd = RABBITMQ_PASSWORD || 'guest';
const host = RABBITMQ_HOST || 'rabbitmq-service';
const port = RABBITMQ_PORT || '5672';

const SMS_CODES_QUEUE       = RABBITMQ_SMS_CODES_QUEUE  || 'SMS_CODES';
const EMAIL_CODES_QUEUE     = RABBITMQ_EMAIL_CODES_QUEUE  || 'EMAIL_CODES';
const SMS_CODES_RESULT_QUEUE  = RABBITMQ_SMS_CODES_RESULT_QUEUE  || 'SMS_CODES_RESULT_QUEUE';
const SMS_CODES_RESULT_SUCCESS_CALLBACK_QUEUE = RABBITMQ_SMS_CODES_RESULT_SUCCESS_CALLBACK_QUEUE  || 'SMS_CODES_RESULT_SUCCESS_CALLBACK_QUEUE';
const TWO_PA_CHANGE_STATUS_QUEUE = RABBITMQ_TWO_PA_CHANGE_STATUS_QUEUE  || 'TWO_PA_CHANGE_STATUS_QUEUE';
const CHANGE_PIN_CODE_QUEUE      = RABBITMQ_CHANGE_PIN_CODE_QUEUE || `CHANGE_PIN_CODE_QUEUE`;
/*
 @confirm - обьект с данными для создания подтверждения
 @requestId - идентификатор запроса кода
 @output {object}
*/

exports.hasConfirmActiveRequestId = (userId = null) => { // передаем обьект с параметрами
  if(!userId) return null;
  return new Promise((resolve, reject) => {  
        db.query( SQL.CONFIRMATION.GET_ACTIVE_USER_REQUEST_ID,
          [userId],
          (err, result) => {
            if (err) {
              logger.error(err); 
              return reject(null);
            }
            resolve(result?.rows?.length > 0 ? true: false);
        }
     );
  });
};
//
exports.isActiveRequestId = (requestId = null) => { // передаем обьект с параметрами
  if(!requestId) return null;
  return new Promise((resolve, reject) => {  
        db.query( SQL.CONFIRMATION.GET_REQUEST_ID_STATUS,
          [requestId],
          (err, result) => {
            if (err) {
              logger.error(err); 
              return reject(null);
            }
            resolve(result?.rows?.length > 0 ? true: false);
        }
     );
  });
};

exports.createConfirmCode = (userId = null, confirmationType= null) => { // передаем обьект с параметрами
  if(!userId || !confirmationType) return null;
  return new Promise((resolve, reject) => {  
        db.query( SQL.CONFIRMATION.CREATE_CONFIRM_CODE,
          [userId, confirmationType],
          (err, results) => {
            if (err) {
              console.log(err); 
              return reject(null);
            }
            resolve(results.rows[0].request_id);
        }
     );
  });
};

exports.setRequestStatus = (requestId = null, status = null) => { // установить статус у запроса
  if(!requestId || !status) return null;
  return new Promise((resolve, reject) => {  
        db.query( SQL.CONFIRMATION.SET_STATUS_REQUEST_ID,
          [requestId, status],
          (err, results) => {
            if (err) {
              console.log(err); 
              return reject(null);
            }
            resolve(results.rows[0]);
        }
     );
  });
};

// Отправка смс-кода 
exports.sendVerificationCodeToBus = async (requestId = null, profile = null ) => { 
  try {
     console.log(requestId, profile?.phone);
     if(!requestId || !profile?.phone) return false;      
      let msg = await exports.getRequestData(requestId);
      console.log(msg);
      let rabbitClient = new ClientProducerAMQP();      
      await  rabbitClient.sendMessage(SMS_CODES_QUEUE , 
        { 
          requestId : msg.request_id, 
          code : msg.code, 
          phone : profile.phone.replace(/\D/g, ''), 
          telegram : true 
        }
      )  
    } catch (error) {
      console.log(`sendVerificationCodeToBus. Ошибка ${error}`);
      return false;
  } 
  return true;
}

// Отправка email-кода 
/*
 {
  "transport": "mail",
  "template": "RETRY_VERIFICATION_CODE_NOTIFICATION",
  "to": "itk_system@mail.ru",
  "subject": "Добро пожаловать на PICKMAX.RU - ваш супермаркет в Интернет! ",
  "text": "test",
  "variables": {
    "HOST_NAME": "PICKMAX.RU",
    "HOST": "pickmax.ru"
  }
}

*/
exports.sendVerificationEmailCodeToBus = async (requestId = null, profile = null ) => { 
  try {
     if(!requestId || !profile?.email) return false;      
      let msg = await exports.getRequestData(requestId);
      let rabbitClient = new ClientProducerAMQP();      
      await  rabbitClient.sendMessage(EMAIL_CODES_QUEUE , 
        { 
          transport: "mail",
          template: "RETRY_VERIFICATION_CODE_NOTIFICATION",
          subject: "Pickmax.Код подтверждения почты",
          to : profile.email, 
          requestId : msg.request_id,           
          variables: {
          CODE: msg.code
        }         
       }
      )  
    } catch (error) {
      console.log(`sendVerificationEmailCodeToBus. Ошибка ${error}`);
      return false;
  } 
  return true;
}

exports.getRequestData = (requestId = null) => { 
  if(!requestId) return false;
  return new Promise((resolve, reject) => {  
    db.query( SQL.CONFIRMATION.SQL_GET_CONFIRMATION_ENTRY,
      [requestId],
      (err, results) => {
        if (err) {
          console.log(err); 
          return reject(null);
        }
        resolve(results?.rows[0] ?? null);
    }
   );
 });
}

exports.create2PHARequestId = (userId = null, requestType = null) => {  // получить идентификатор запрос на смену 2PA - вопрос или цифрового кода
  if(!requestType || !userId) return false;
  return new Promise((resolve, reject) => {  
    db.query( SQL.CONFIRMATION.SQL_CREATE_2PHA_USER_REQUEST_ID,
      [userId, requestType],
      (err, results) => {
        if (err) {
          console.log(err); 
          return reject(null);
        }
        resolve(results?.rows[0]?.requestId ?? null);
    }
   );
 });
}

exports.disable2PHARequestId = (userId = null, requestType = null) => {  // запрещаем другие запросы при создании нового запроса
  if(!requestType || !userId) return false;
  return new Promise((resolve, reject) => {  
    db.query( SQL.CONFIRMATION.SQL_DISABLE_2PHA_USER_REQUESTS_BY_TYPE,
      [userId, requestType],
      (err, results) => {
        if (err) {
          console.log(err); 
          return reject(null);
        }
        resolve(results?.rows[0]?.requestId ?? null);
    }
   );
 });
}


exports.get2PHARequestId = (userId = null, requestType = null) => {  // получить идентификатор запрос на смену 2PA - вопрос или цифрового кода
  if(!requestType || !userId) return false;
  return new Promise((resolve, reject) => {  
    db.query( SQL.CONFIRMATION.SQL_FIND_2PHA_USER_REQUEST_BY_USER_ID,
      [userId, requestType],
      (err, results) => {
        if (err) {
          console.log(err); 
          return reject(null);
        }
        resolve(results?.rows[0] ?? null);
    }
   );
 });
}

exports.change2PHARequestId = (msg) => {  // изменение статуса
  const {userId, requestId, status} = msg;
  if(!requestId || !userId || !status) return false;
  return new Promise((resolve, reject) => {  
    db.query( SQL.CONFIRMATION.SQL_SET_STATUS_2PHA_USER_REQUEST_BY_ID,
      [userId, requestId, status],
      (err, results) => {
        if (err) {
          console.log(err); 
          return reject(null);
        }
        resolve(results?.rows[0] ?? null);
    }
   );
 });
}


async function startConsumer(queue, handler) {
  try {
      const connection = await amqp.connect(`amqp://${login}:${pwd}@${host}:${port}`);
      const channel = await connection.createChannel();
      await channel.assertQueue(queue, { durable: true });
      console.log(`Listening on queue ${queue}...`);
      channel.consume(queue, async (msg) => {
          if (msg) {
              try {
                  const data = JSON.parse(msg.content.toString());
                  await handler(data);
                  channel.ack(msg);
              } catch (error) {
                  console.error(`Error processing message: ${error}`);
              }
          }
      });
  } catch (error) {
      console.error(`Error connecting to RabbitMQ: ${error}`);
  }
}

async function updateRequestData(msg = null) { 
  if(!msg) return null;
  return new Promise((resolve, reject) => {  
        db.query( SQL.CONFIRMATION.UPDATE_SEND_CONFIRM_CODE_RESULT,
          [msg.requestId,msg.status],
          (err, results) => {
            if (err) {
              console.log(err); 
              return reject(null);
            }
            resolve(results.rows[0]);
        }
     );
  });
};

//  отправка результата проверки кода в МС Клиент
exports.sendVerificationResultToBus = async (requestId = null) => { 
  try {
     if(!requestId) return false;      
      let msg = await exports.getRequestData(requestId);
      let rabbitClient = new ClientProducerAMQP();      
      await  rabbitClient.sendMessage(SMS_CODES_RESULT_SUCCESS_CALLBACK_QUEUE , msg)  
    } catch (error) {
      console.log(`sendVerificationResultToBus. Ошибка ${error}`);
      return false;
  } 
  return true;
}

exports.sendPINCodeStatusResultToBus = async (requestId = null, action = null,  pinCode = null) => { 
  try {
     console.log(`sendPINCodeStatusResultToBus`, requestId, action);  
     if(!requestId || !action) return false;      
      let msg = await exports.getRequestData(requestId);      
      msg.action = action;
      msg.pin_code = pinCode ?? null;
      console.log(`sendPINCodeStatusResultToBus`, msg );  
      let rabbitClient = new ClientProducerAMQP();      
      await  rabbitClient.sendMessage(CHANGE_PIN_CODE_QUEUE , msg)  
    } catch (error) {
      console.log(`sendPINCodeStatusResultToBus. Ошибка ${error}`);
      return false;
  } 
  return true;
}


// чтение результата отправки кода смс
startConsumer(SMS_CODES_RESULT_QUEUE, async (msg) => { 
  try {
    console.log(msg);  
     await updateRequestData(msg); 
  } catch (error) {
    console.log(error); 
  }
});

/*
 Изменяем статус { userId, requestId, status - "PENDING", "ERROR", "SUCCESS", "FAILED"}
  { "userId" : 14, 
    "requestId" : "455eb0ee-a550-46a6-b480-45fdbc91952d", 
   "status" : "FAILED"
   }
 */
startConsumer(TWO_PA_CHANGE_STATUS_QUEUE, async (msg) => { 
  try {
    console.log(msg);  
      await exports.change2PHARequestId(msg)
  } catch (error) {
    console.log(error); 
  }
});

