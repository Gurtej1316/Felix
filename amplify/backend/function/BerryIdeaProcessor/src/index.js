/* Amplify Params - DO NOT EDIT
  ENV
  REGION
  STORAGE_ORGPATTERN_ARN
  STORAGE_ORGPATTERN_NAME
  STORAGE_ORGPATTERN_STREAMARN
  STORAGE_ORGUSER_ARN
  STORAGE_ORGUSER_NAME
  STORAGE_ORGUSER_STREAMARN
  STORAGE_ORG_ARN
  STORAGE_ORG_NAME
  STORAGE_ORG_STREAMARN
Amplify Params - DO NOT EDIT *//* Amplify Params - DO NOT EDIT
  ENV
  REGION
  STORAGE_ORGIDEA_ARN
  STORAGE_ORGIDEA_NAME
  STORAGE_ORGUSER_ARN
  STORAGE_ORGUSER_NAME
  STORAGE_ORG_ARN
  STORAGE_ORG_NAME
Amplify Params - DO NOT EDIT */

const https = require('https');
const AWS = require('aws-sdk');
const { postSlackMessageToUser } = require('@commonutils/slackUtils');
const {lockUser,isUserLocked } = require('@commonutils/userLockService');
const { TableNames } = require('@commonutils/constants');

AWS.config.update({ region: process.env.TABLE_REGION });

const dynamodb = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {

  let queryParams = {
    TableName: TableNames.PATTERN,
    FilterExpression: "#patternType = :patternStr",
    ExpressionAttributeNames: {
      "#patternType": "patternType",
    },
    ExpressionAttributeValues: {
      ":patternStr": 'idea',
    }

  };

  const ideaData = await dynamodb.scan(queryParams).promise();

  for (const element of ideaData.Items) {

    //getting the slack token for the user's org
    queryParams = {
      TableName: TableNames.ORG,
      Key: {
        "orgId": element.orgId
      }
    };
    //there will only be one orgData returned always
    let orgData = await dynamodb.get(queryParams).promise();
    let slackToken, callbackId;
    if (orgData) {
      slackToken = orgData.Item?.slackToken;
      callbackId = orgData.Item?.callbackId;
    } else {
      console.error("No slack token configured for the org : ", element.orgId);
    }

    if (element.vote === 1) {
      queryParams = {
        TableName: TableNames.USER,
        KeyConditionExpression: "#org = :orgId",
        ExpressionAttributeNames: {
          "#org": "orgId"
        },
        ExpressionAttributeValues: {
          ":orgId": element.orgId
        }
      };

      const userData = await dynamodb.query(queryParams).promise();
      for (const userElement of userData.Items) {


        let message = "Hi <@" + userElement.commId + ">. I aggregated a new idea based on my conversations with the organization: `";
        message = message + element.summary + "`.";

        let attachments = [{
          id: 0,
          text: "What are your thoughts on the idea?",
          callback_id: callbackId,
          actions: [
            {
              id: 0,
              name: "Love it",
              text: "Love it",
              type: "button",
              value: "Idea Voting  " + element.patternId + " 1",
              style: "primary"
            },
            {
              id: 1,
              name: "Not Sure",
              text: "Not Sure",
              type: "button",
              value: "Idea Voting  " + element.patternId + " 0.5"
            },
            {
              id: 2,
              name: "Meh!",
              text: "Meh!",
              type: "button",
              value: "Idea Voting  " + element.patternId + " 0"
            }
          ]
        }];
        
        let isUserLockedFlag = true; //default to TRUE that the user is locked
        if(userElement){
          isUserLockedFlag = await isUserLocked(userElement);
        }
        
        if(!isUserLockedFlag){
          //case when user is not locked - send ping and lock the user
          console.log("case when user is not locked");
          await postSlackMessageToUser(userElement.commId, message, attachments, slackToken);
          await lockUser(userElement.orgId,userElement.userId);

        }else{
          console.log("user is locked as of now",JSON.stringify(userElement));
        }

      }

      queryParams = {
        TableName: TableNames.PATTERN,
        Key: {
          "orgId": element.orgId,
          "patternId": element.patternId
        },
        UpdateExpression: "SET vote = :vote",
        ExpressionAttributeValues: {
          ":vote": 2
        }
      };
      await dynamodb.update(queryParams).promise();
    }
  }
};