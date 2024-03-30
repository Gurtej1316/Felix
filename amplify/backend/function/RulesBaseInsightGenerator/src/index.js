/* Amplify Params - DO NOT EDIT
	ENV
	REGION
	STORAGE_CONVERSATIONS_ARN
	STORAGE_CONVERSATIONS_NAME
	STORAGE_CONVERSATIONS_STREAMARN
	STORAGE_ORGINSIGHTS_ARN
	STORAGE_ORGINSIGHTS_NAME
	STORAGE_ORGINSIGHTS_STREAMARN
	STORAGE_ORGPATTERN_ARN
	STORAGE_ORGPATTERN_NAME
	STORAGE_ORGPATTERN_STREAMARN
	STORAGE_ORGSTEP_ARN
	STORAGE_ORGSTEP_NAME
	STORAGE_ORGSTEP_STREAMARN
	STORAGE_ORGUSER_ARN
	STORAGE_ORGUSER_NAME
	STORAGE_ORGUSER_STREAMARN
	STORAGE_ORG_ARN
	STORAGE_ORG_NAME
	STORAGE_ORG_STREAMARN
Amplify Params - DO NOT EDIT */

/**
 * @type {import('@types/aws-lambda').APIGatewayProxyHandler}
 */
exports.handler = async (event) => {
    console.log(`EVENT: ${JSON.stringify(event)}`);
    return {
        statusCode: 200,
    //  Uncomment below to enable CORS requests
    //  headers: {
    //      "Access-Control-Allow-Origin": "*",
    //      "Access-Control-Allow-Headers": "*"
    //  }, 
        body: JSON.stringify('Hello from Lambda!'),
    };
};
