/* Amplify Params - DO NOT EDIT
	ENV
	REGION
	STORAGE_ORGFAQ_ARN
	STORAGE_ORGFAQ_NAME
	STORAGE_ORGFAQ_STREAMARN
	STORAGE_ORGUSER_ARN
	STORAGE_ORGUSER_NAME
	STORAGE_ORGUSER_STREAMARN
	STORAGE_ORG_ARN
	STORAGE_ORG_NAME
	STORAGE_ORG_STREAMARN
Amplify Params - DO NOT EDIT */
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
 
