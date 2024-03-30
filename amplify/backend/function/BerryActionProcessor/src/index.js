/* Amplify Params - DO NOT EDIT
	ENV
	REGION
	STORAGE_ORGACTION_ARN
	STORAGE_ORGACTION_NAME
	STORAGE_ORGACTION_STREAMARN
	STORAGE_ORGUSER_ARN
	STORAGE_ORGUSER_NAME
	STORAGE_ORGUSER_STREAMARN
	STORAGE_ORG_ARN
	STORAGE_ORG_NAME
	STORAGE_ORG_STREAMARN
Amplify Params - DO NOT EDIT */

const https = require('https');
const AWS = require('aws-sdk');
const { postSlackMessageToUser } = require('@commonutils/slackUtils');
const { getFilteredEmployees } = require('@searchutils/employees');
const { lockUser,isUserLocked } = require('@commonutils/userLockService');
const { TableNames } = require('@commonutils/constants');

AWS.config.update({ region: process.env.TABLE_REGION });
const dynamodb = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {

  let queryParams = {
    TableName: TableNames.ACTION,
  };

  const actionData = await dynamodb.scan(queryParams).promise();
  var currentDate = new Date();

  for (const element of actionData.Items) {

    let actionCheckDate = new Date(element.dueDate);
    actionCheckDate.setDate(actionCheckDate.getDate() - 5);

    if (element.progress < 100 && actionCheckDate < currentDate && element.ownerCommId) {

      let message = null;
      if (!element.reminderDate) {
        message =  "Hi <@"+element.ownerCommId+"> ,you have an action coming due in the next few days: \"";
        message = message + element.summary + "\". Just reminding you.";
      }
      else {
        let reminderCheckDate = new Date(element.reminderDate);
        reminderCheckDate.setDate(reminderCheckDate.getDate() + 2);

        if (reminderCheckDate < currentDate && (!element.updatedDate || element.updatedDate > element.reminderDate)) {
          message = "Hi <@"+element.ownerCommId+"> ,I checked with you a few days back on this action that was assigned to you: \"";
          message = message + element.summary + "\". Just checking back.";

        }
      }

      if (message) {

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
          continue;
        }
        let attachments = [{
          id: 0,
          text: "I will be happy to update the completion on your behalf.",
          callback_id: callbackId,
          actions: [
            {
              id: 0,
              name: "Completed",
              text: "Completed",
              type: "button",
              value: "Update Action Process " + element.actionId + " 100",
              style: "primary"
            },
            {
              id: 1,
              name: "75%",
              text: "75%",
              type: "button",
              value: "Update Action Process " + element.actionId + " 75"
            },
            {
              id: 2,
              name: "50%",
              text: "50%",
              type: "button",
              value: "Update Action Process " + element.actionId + " 50"
            },
            {
              id: 3,
              name: "25%",
              text: "25%",
              type: "button",
              value: "Update Action Process " + element.actionId + " 25"
            },
            {
              id: 4,
              name: "10%",
              text: "10%",
              type: "button",
              value: "Update Action Process " + element.actionId + " 10"
            }
          ]
        }];

        //fetch user details using orgId and commId
        let searchCond = [
          { match: { "commId": element.ownerCommId } }
        ];
        let userData = await getFilteredEmployees(element.orgId,searchCond);
        userData = userData && userData[0] ? userData[0] : undefined; //setting userData[0] to userData for better readability for the rest of the code
  
        let isUserLockedFlag = true; //default to TRUE that the user is locked
        if(userData){
          isUserLockedFlag = await isUserLocked(userData);
        }

        if(!isUserLockedFlag){
          //case when user is not locked - send ping and lock the user
          console.log("case when user is not locked");
          await postSlackMessageToUser(userData.commId, message, attachments, slackToken);
          await lockUser(userData.orgId,userData.userId);

          //update the action item
          queryParams = {
            TableName: TableNames.ACTION,
            Key: {
              "orgId": element.orgId,
              "actionId": element.actionId
            },
            UpdateExpression: "SET reminderDate = :currentDate",
            ExpressionAttributeValues: {
              ":currentDate": +currentDate
            }
          };
          await dynamodb.update(queryParams).promise();

        }else{
          console.log("user is locked as of now",JSON.stringify(userData));
        }
      }

    }
  }


};