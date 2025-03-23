const db = require('openfsm-database-connection-producer');
const common      = require('openfsm-common');  /* Библиотека с общими параметрами */
const SQL        = require('common-confirmation-service').SQL;
const MESSAGES   = require('common-confirmation-service').MESSAGES;
const logger     = require('openfsm-logger-handler');

require('dotenv').config({ path: '.env-delivery-service' });
const ClientProducerAMQP  =  require('openfsm-client-producer-amqp'); // ходим в почту через шину
const amqp = require('amqplib');


/* Коннектор для шины RabbitMQ */
const {
  RABBITMQ_HOST, RABBITMQ_PORT, RABBITMQ_USER, RABBITMQ_PASSWORD,  RABBITMQ_ORDER_STATUS_QUEUE,  RABBITMQ_DELIVERY_RESERVATION_QUEUE, RABBITMQ_DELIVERY_DECLINE_QUEUE  } = process.env;
const login = RABBITMQ_USER || 'guest';
const pwd = RABBITMQ_PASSWORD || 'guest';
const ORDER_STATUS_QUEUE       = RABBITMQ_ORDER_STATUS_QUEUE || 'ORDER_STATUS';
const DELIVERY_RESERVATION_QUEUE  = RABBITMQ_DELIVERY_RESERVATION_QUEUE || 'DELIVERY_RESERVATION';
const DELIVERY_DECLINE_QUEUE   = RABBITMQ_DELIVERY_DECLINE_QUEUE || 'DELIVERY_DECLINE';
const host = RABBITMQ_HOST || 'rabbitmq-service';
const port = RABBITMQ_PORT || '5672';



/*
 @deliveryTypeId - Тип доставки
 @timeSlotId - временной слот
 @output {object}
*/
exports.findCourierByTimeSlot = (deliveryTypeId, timeSlotId) => { // найти курьера  по типу и временному слоту
  return new Promise((resolve, reject) => {  
        db.query( SQL.DELIVERY.FIND_COURIER_BY_TIME_SLOT,
          [deliveryTypeId, timeSlotId],
          (err, results) => {
            if (err) {
              console.log(err); 
              return reject(null);
            }
            resolve(results[0]);
        }
     );
  });
};
/*
 @courierId - ID курьера
  @output {object}
*/
exports.findCourierById = (courierId) => { // найти курьера  по ID
  return new Promise((resolve, reject) => {  
        db.query(
          SQL.DELIVERY.FIND_COURIER_BY_ID, [courierId],
          (err, results) => {
            if (err) {
              console.log(err); 
              return reject(null);
            }
            resolve(results[0]);
        }
     );
  });
};
/*
 @deliveryDate - дата доставки
 @courierId - ID курьера
 @output {object}
*/
exports.getCourierOrderCount = (deliveryDate, courierId) => { // найти количество заказов у курьера на определенный день
  return new Promise((resolve, reject) => {  
        db.query(SQL.DELIVERY.GET_COURIER_ORDER_COUNT, [deliveryDate, courierId],
          (err, results) => {
            if (err) {
              console.log(err); 
              return reject(null);
            }
            resolve(results[0]);
        }
     );
  });
};
/*
 @deliveryDate - дата доставки
 @courierId - ID курьера
 @output {object} 
 Найти нужного курьера
*/
exports.findCourier = (deliveryDate, deliveryTypeId) => { 
  return new Promise((resolve, reject) => {  
        db.query(SQL.DELIVERY.FIND_COURIER, [deliveryDate, deliveryTypeId],
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

exports.findDeliveryOrder = (orderId) => { // найти заказ на доставку c назначенным курьером
  return new Promise((resolve, reject) => {  
        db.query(SQL.DELIVERY.FIND_DELIVERY_ORDER, [orderId],
          (err, results) => {
            if (err) {
              console.log(err); 
              return reject(null);
            }
            resolve(results[0]);
        }
     );
  });
};

/*
 @deliveryDate - дата доставки
 @courierId - ID курьера
 @output {object}
*/
exports.deliveryAdd = (orderId, deliveryDate, courierId) => {
  return new Promise((resolve, reject) => {
      // Валидация входных данных
      if (!orderId || !deliveryDate || !courierId) {
          return reject(new Error("Invalid input parameters"));
      }      
      db.query(SQL.DELIVERY.DELIVERY_ORDER_ADD,
          [orderId, deliveryDate, courierId],
          (err, results) => {
              if (err) {
                  console.error("Database error:", err);
                  return reject(err); // Передать ошибку дальше
              }
             resolve(results?.rows[0]?.id || null); // Успешная вставка
          }
      );
  });
};


// Создали заказ
exports.create = (orderId, date, deliveryType) => {
  return new Promise(async (resolve, reject) => {
    let courier;
    try {
      courier = await exports.findCourier(date, deliveryType);
      if (!courier) {
        console.error(`Курьер не найден: deliveryDate=${date}, deliveryType=${deliveryType}`);
        return reject(false);
      }
      const [deliveryId] = await Promise.all([
        // exports.findDeliveryOrder(orderId),
        exports.deliveryAdd(orderId, date, courier.courier_id)
      ]);
        return resolve(deliveryId);
      } catch (err) {
      logger.error(`Ошибка: ${err.message}`);
      return reject(false); // Завершить выполнение на ошибке
    }
  });
};



// отменили  заказ
exports.decline = (orderId) => {
  return new Promise((resolve, reject) => {  
    db.query(SQL.DELIVERY.DECLINE, [orderId],
      (err, results) => {
        if (err) {
          console.log(err); 
          return reject(err);
        }
        resolve(orderId);
    }
   );
 });
};


// Добавить адрес
exports.addAddress = (address, userId = null) => {
  if(!userId) return reject('userId not exist');
  return new Promise((resolve, reject) => {  
    db.query(SQL.USER.ADD_ADDRESS, [
      address.getFiasId() || null,
      address.getFiasLevel() || null,
      address.getValue() || null,
      address.getCity() || null,
      address.getCountry() || null,
      address.getFlat() || null,
      address.getHouse() || null,
      address.getPostalCode() || null,
      address.getRegion() || null,
      address.getStreet() || null,
      userId
    ],
      (err, result) => {
        if (err) {
          console.log(err); 
          return reject(err);
        }
        resolve(result?.rows[0]?.address_id || null);
    }
   );
 });
};

// Удалить адрес
exports.deleteAddress = (addressId, userId = null) => {
  if(!userId) return reject('userId not exist');
  return new Promise((resolve, reject) => {  
    db.query(SQL.USER.DELETE_ADDRESS, [      
      userId, addressId
    ],
      (err, result) => {
        if (err) {
          console.log(err); 
          return reject(err);
        }
        resolve(true);
    }
   );
 });
};


exports.getAddresses = (userId = null) => {
  if(!userId) return reject('userId not exist');
  return new Promise((resolve, reject) => {  
    db.query(SQL.USER.GET_ADDRESSES, [      
      userId
    ],
      (err, result) => {
        if (err) {
          console.log(err); 
          return reject(err);
        }
        let adresses = result.rows.map(row => new AddressDto(row).toJSON());
        resolve(adresses);
    }
   );
 });
};



exports.setAddress = (addressId = null, userId = null) => {
  if(!userId || !addressId) return reject('userId or addressId not exist');
  return new Promise((resolve, reject) => {  
    db.query(SQL.USER.SET_ADDRESSES, [      
      addressId, userId
    ],
      (err, result) => {
        if (err) {
          console.log(err); 
          return reject(err);
        }
        let adresses = result.rows.map(row => new AddressDto(row).toJSON());
        resolve(adresses);
    }
   );
 });
};

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
                  // channel.nack(msg, false, true); // Повторная попытка
              }
          }
      });
  } catch (error) {
      console.error(`Error connecting to RabbitMQ: ${error}`);
  }
}

/*
{
"orderId":41, 
"deliveryId" : "COURIER_SERVICE"
}
*/

startConsumer(DELIVERY_RESERVATION_QUEUE, async (msg) => {
   const today = new Date();
   const year = today.getFullYear();
   const month = String(today.getMonth() + 1).padStart(2, '0'); // Месяцы начинаются с 0
   const day = String(today.getDate()).padStart(2, '0');
   const formattedDate = `${year}-${month}-${day}`;
   let result = 
      await  exports.create(msg.order.orderId, formattedDate, msg.order.deliveryId)       
   if(!result) { // если курьер не назначен - ставим статус Поиск 
    await searchCourierMessageSend(msg);
   }
});

startConsumer(DELIVERY_DECLINE_QUEUE, async (msg) => {
  await exports.decline(msg.order.orderId),
  await courierSearchOrderStatusMessageSend(msg)
});

async function searchCourierMessageSend(msg){ // поставить статус - поиск курьера (когда нет свободного)
  try {
     let rabbitClient = new ClientProducerAMQP();
      await  rabbitClient.sendMessage(ORDER_STATUS_QUEUE, {status: true, processStatus : 'COURIER_SEARCH',  order: msg.order })  
    } catch (error) {
      console.log(`declineStatusMessageSend. Ошибка ${error}`);
  } 
  return;
}

async function searchCourierMessageSend(msg){ // ищем курьера
  try {
     let rabbitClient = new ClientProducerAMQP();
      await  rabbitClient.sendMessage(ORDER_STATUS_QUEUE, msg)  
    } catch (error) {
      console.log(`declineStatusMessageSend. Ошибка ${error}`);
  } 
  return;
}

