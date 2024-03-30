/* Amplify Params - DO NOT EDIT
    ENV
    REGION
    STORAGE_ORGPING_ARN
    STORAGE_ORGPING_NAME
    STORAGE_ORGPING_STREAMARN
    STORAGE_ORGUSER_ARN
    STORAGE_ORGUSER_NAME
    STORAGE_ORGUSER_STREAMARN
    STORAGE_ORG_ARN
    STORAGE_ORG_NAME
    STORAGE_ORG_STREAMARN
Amplify Params - DO NOT EDIT */
var AWS = require('aws-sdk')
AWS.config.update({ region: process.env.TABLE_REGION });
const dynamodb = new AWS.DynamoDB.DocumentClient();
const { TableNames } = require('@commonutils/constants');
const { sendPingBasedOnCommChannel } = require('@communicationutils/commonPingServices');

exports.handler = async (event) => {
    let queryParams = {
        TableName: TableNames.PING,
        FilterExpression: '#pingStatus = :pingStatus',
    ExpressionAttributeNames: {
        '#pingStatus': 'pingStatus',
    },
    ExpressionAttributeValues: {
        ':pingStatus': 'Active',
    }
    };

    const pingData = await dynamodb.scan(queryParams).promise();
    for (const pingItem of pingData.Items) {
        try {
            await sendPingBasedOnCommChannel(pingItem);
        } catch (error) {
            console.log("Error sending ping for item-", pingItem);
        }
    }
};
