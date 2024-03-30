
const dialogApp = require('./app');

/**
 * @type {import('@types/aws-lambda').APIGatewayProxyHandler}
 */
 exports.handler =  (event,context,callback) => {
    console.log("Event ",JSON.stringify(event));
    console.log("Context ", JSON.stringify(context));
     try {
      dialogApp.dispatchDialog(event, (response) => callback(null, response));
    } catch (err) {
        callback(err);
    }
};
