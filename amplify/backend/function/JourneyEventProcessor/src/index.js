/* Amplify Params - DO NOT EDIT
	ENV
	REGION
	STORAGE_ORGUSER_ARN
	STORAGE_ORGUSER_NAME
	STORAGE_ORGUSER_STREAMARN
	STORAGE_ORGWORKFLOW_ARN
	STORAGE_ORGWORKFLOW_NAME
	STORAGE_ORGWORKFLOW_STREAMARN
	STORAGE_ORG_ARN
	STORAGE_ORG_NAME
	STORAGE_ORG_STREAMARN
Amplify Params - DO NOT EDIT */

const { EventTypes } = require('@commonutils/constants');
const services = require('./services');


/**
 * @type {import('@types/aws-lambda').APIGatewayProxyHandler}
 */
exports.handler = async (event) => {
	console.log(`EVENT: ${JSON.stringify(event)}`);
	try{

		if(event.eventType === EventTypes.NEW_CAMPAIGN){
			await services.processNewCampaign(event);
			
		} else {
			console.log("Unhandled eventType or missing eventType - exit");
			return ;
		}

	}catch (error) {
        console.error(error);
    }

};
