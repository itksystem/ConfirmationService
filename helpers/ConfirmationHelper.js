const db = require('openfsm-database-connection-producer');
const common      = require('openfsm-common');  /* Библиотека с общими параметрами */
const SQL        = require('common-confirmation-service').SQL;
const MESSAGES   = require('common-confirmation-service').MESSAGES;
const logger     = require('openfsm-logger-handler');

require('dotenv').config({ path: '.env-confirmation-service' });
const ClientProducerAMQP  =  require('openfsm-client-producer-amqp'); // ходим в почту через шину
const amqp = require('amqplib');


/* Коннектор для шины RabbitMQ */
const { RABBITMQ_HOST, RABBITMQ_PORT, RABBITMQ_USER, RABBITMQ_PASSWORD,  RABBITMQ_SMS_CODES_QUEUE, RABBITMQ_SMS_CODES_RESULT_QUEUE, RABBITMQ_SMS_CODES_RESULT_SUCCESS_CALLBACK_QUEUE  } = process.env;
const login = RABBITMQ_USER || 'guest';
const pwd = RABBITMQ_PASSWORD || 'guest';
const host = RABBITMQ_HOST || 'rabbitmq-service';
const port = RABBITMQ_PORT || '5672';

const SMS_CODES_QUEUE       = RABBITMQ_SMS_CODES_QUEUE  || 'SMS_CODES';
const SMS_CODES_RESULT_QUEUE  = RABBITMQ_SMS_CODES_RESULT_QUEUE  || 'SMS_CODES_RESULT_QUEUE';
const SMS_CODES_RESULT_SUCCESS_CALLBACK_QUEUE = RABBITMQ_SMS_CODES_RESULT_SUCCESS_CALLBACK_QUEUE  || 'SMS_CODES_RESULT_SUCCESS_CALLBACK_QUEUE';

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


exports.sendVerificationCodeToBus = async (requestId = null, profile = null ) => { 
  try {
     if(!requestId || !profile?.phone) return false;      
      let msg = await exports.getRequestData(requestId);
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
      console.log(`sendCodeToESB. Ошибка ${error}`);
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
        resolve(results.rows[0]);
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

// чтение результата отправки кода смс
startConsumer(SMS_CODES_RESULT_QUEUE, async (msg) => { 
  try {
    console.log(msg);  
     await updateRequestData(msg); 
  } catch (error) {
    console.log(error); 
  }
});

