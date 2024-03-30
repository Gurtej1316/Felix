/* Amplify Params - DO NOT EDIT
	ENV
	REGION
	STORAGE_ORGUSER_ARN
	STORAGE_ORGUSER_NAME
	STORAGE_ORGUSER_STREAMARN
	STORAGE_ORG_ARN
	STORAGE_ORG_NAME
	STORAGE_ORG_STREAMARN
Amplify Params - DO NOT EDIT *//**
 //type {import('@types/aws-lambda').APIGatewayProxyHandler}
 */
const {fetchUsersOfOrg} = require('@dbutils/user');
const { listAllOrgDetails } = require('@dbutils/orgEntity');
const { sendReminderInSlack , sendReminderInTeams, sendReminderSms} = require('./services');
const { CommChannels } = require('@commonutils/constants');

exports.handler = async (event) => {
    console.log(`EVENT: ${JSON.stringify(event)}`);
    const allOrgIds = await listAllOrgDetails(["orgId", "slackToken", "callbackId"]);
    for (const orgObj of allOrgIds) {
        let users = await fetchUsersOfOrg(orgObj.orgId);
        for (const userObj of users) {
            if (!userObj.lastInteractionDate) {
                if (userObj.commChannel && userObj.commChannel == CommChannels.SLACK) {
                    //console.log("inside when commChannel is slack", userObj);
                    await sendReminderInSlack(orgObj, userObj);
                }
                else if (userObj.commChannel && userObj.commChannel == CommChannels.TEAMS) {
                    //console.log("inside when commChannel is teams", userObj);
                    await sendReminderInTeams(userObj);
                }
                else if (userObj.commChannel && userObj.commChannel == CommChannels.SMS) {
                    await sendReminderSms(userObj);
                }
                else {
                    console.log("inside when commChannel is null/Email", userObj);
                }
            }
            else{
                console.log("User already asked FAQ questions");
            }
           
        }
    }
};
