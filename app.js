const express = require('express');
const bodyParser = require('body-parser');
const confirmationRoute = require('./routes/confirmation');
require('dotenv').config({ path: '.env-confirmation-service' });

const app = express();
app.use(bodyParser.json());

app.use(function(request, response, next){
  console.log(request);  
  next();
});

app.use('/api/confirmation', confirmationRoute);



app.listen(process.env.PORT, () => {
  console.log(`
    ******************************************
    * ${process.env.SERVICE_NAME} running on port ${process.env.PORT} *
    ******************************************`);
});

