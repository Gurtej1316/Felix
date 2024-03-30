/* Amplify Params - DO NOT EDIT
	ENV
	REGION
	STORAGE_ORGFAQ_ARN
	STORAGE_ORGFAQ_NAME
	STORAGE_ORGFAQ_STREAMARN
	STORAGE_ORGROLEPERMISSIONS_ARN
	STORAGE_ORGROLEPERMISSIONS_NAME
	STORAGE_ORGROLEPERMISSIONS_STREAMARN
	STORAGE_ORGUSER_ARN
	STORAGE_ORGUSER_NAME
	STORAGE_ORGUSER_STREAMARN
	STORAGE_ORG_ARN
	STORAGE_ORG_NAME
	STORAGE_ORG_STREAMARN
Amplify Params - DO NOT EDIT */
const AWS = require('aws-sdk');
const { fetchOrgFaqForTraining} = require('@dbutils/faq');
const { postSlackMessageToUser } = require('@commonutils/slackUtils');
const { listAllOrgDetails } = require('@dbutils/orgEntity');
const { TableNames } = require('@commonutils/constants');
const teamsService = require('./teamsService');
AWS.config.update({ region: process.env.TABLE_REGION });
const { fetchUserForRoleFromDB } = require('@dbutils/user');

const dynamodb = new AWS.DynamoDB.DocumentClient();
exports.handler = async (event) => {
  const allOrgIds = await listAllOrgDetails(["orgId","slackToken","callbackId","campaignStartMessages"]); //getting all org Ids from the table
  if(allOrgIds){
    for(const orgObj of allOrgIds){
      var slackToken = orgObj.slackToken;
      var callbackId = orgObj.callbackId;
      console.log("slackToken :", slackToken , "callbackId : ", callbackId);      
      var faqOrgResponse = await fetchOrgFaqForTraining(orgObj.orgId);
      console.log("faqOrgResponse",faqOrgResponse);      
      if(faqOrgResponse && faqOrgResponse.length > 0){
        queryParams = {
          TableName: TableNames.ROLEPERMISSIONS,
          KeyConditionExpression: "#org = :orgId",
          FilterExpression: "contains (userPermissions, :permission)",
          ExpressionAttributeNames: {
            "#org": "orgId"
          },
          ExpressionAttributeValues: {
            ":orgId": orgObj.orgId,
            ":permission" : "Missed_Faq_Ping_Permission"
          }
        };
        const roleData = await dynamodb.query(queryParams).promise();
        console.log("roleData: ", roleData);
        if(roleData){
          var orgUsers;
          for (const role of roleData.Items ) {
            orgUsers = await fetchUserForRoleFromDB(orgObj.orgId, role.userRole);
            var attachments = [];
            if(orgUsers){
              for (const user of orgUsers ) {
                var message = "Hi "+ user.firstName + " ,";
                var missedTextList = [];
                var faqCount = 0;
                var faqTextMessage = message + " We have few Employee queries which Berry couldn't reply. Could you please have a look." + "\n";
                var userTextMessage ="";
                for (const missedFaq of faqOrgResponse ) {
                  faqCount++;
                  let userText = faqCount + ". "+ missedFaq.userText;
                  let faqText = {"title" : userText };
                  userTextMessage = userTextMessage + userText + "\n";
                  missedTextList.push(faqText);
                  missedTextList.push(",");
                }
                faqTextMessage = faqTextMessage + userTextMessage;
                attachments= [
                  {
                    "mrkdwn_in": ["text"],
                      "color": "#36a64f",
                      "pretext": "We have few Employee queries which Berry couldn't reply",
                      "text": "Could you please have a look",
                      "fields": missedTextList
                  }
                ]
                if(user.commChannel === "Slack"){
                  await postSlackMessageToUser(user.commId, message, attachments, slackToken);
                }else if(user.commChannel === "Teams"){
                  let messageType = 'Text';
                  await teamsService.sendUserMessage(orgObj.orgId, user.commId, user.serviceUrl, faqTextMessage, messageType , null)
                              .then(async result => {
                              console.log("Sent missed faq to Teams user with FAQ permission-",result);
                          })
                          .catch(err => console.error(`Error doing the request for the event: `,err));
                }
              }
            }
          }
        }
      }
    }
  }
};
