const https = require('https');
const AWS = require('aws-sdk');
AWS.config.update({ region: process.env.TABLE_REGION });
const dynamodb = new AWS.DynamoDB.DocumentClient();

const getSlackChUsers = ((urlOptions, data) => {
    return new Promise((resolve, reject) => {
      const req = https.request(urlOptions,
        (res) => {
          let body = '';
          res.on('data', (chunk) => (body += chunk.toString()));
          res.on('error', reject);
          res.on('end', () => {
            if (res.statusCode >= 200 && res.statusCode <= 299) {
              resolve({ statusCode: res.statusCode, headers: res.headers, body: body });
            } else {
              reject('Request failed. status: ' + res.statusCode + ', body: ' + body);
            }
          });
        });
      req.on('error', reject);
      req.write('');
      req.end();
    });
});

const campaignDateCheck = function (element) {
    let todayDate = new Date();
    todayDate = new Date(todayDate.getFullYear() + '-' + (todayDate.getMonth() + 1) + '-' + todayDate.getDate());
    let startDate = new Date(element.startDate);
    let campaignStartDateFormatted = new Date(startDate.getFullYear() + '-' + (startDate.getMonth() + 1) + '-' + startDate.getDate());
    console.log("Today's Date : ", todayDate, "\n Campaign Start Date : ", campaignStartDateFormatted);

    if (campaignStartDateFormatted.getTime() - todayDate.getTime() > 0) {
        //case when campaign start date is in the future
        console.log("Campaign Start Date is in the future", element);
        return false;

    } else if (todayDate.getTime() - campaignStartDateFormatted.getTime() > 0) {
        //case when start date is in the past - we will check whether end date has also gone or not
        let endDate = new Date(element.endDate);
        let campaignEndDateFormatted = new Date(endDate.getFullYear() + '-' + (endDate.getMonth() + 1) + '-' + endDate.getDate());

        if (todayDate.getTime() - campaignEndDateFormatted.getTime() > 0) {
        //case when end date is also has also gone
        console.warn("Campaign Start Date and End Date are in the past ", element);
        return false;
        }
    }

    return true;
};

const computeFilteredUserList = async function (element,slackToken,userTableName) {
    let filteredUserList = [];
    if (element.audienceList && element.audienceList !== undefined && element.audienceList !== null) {
        let queryParams = {
            TableName: userTableName,
            KeyConditionExpression: "#org = :orgId",
            ExpressionAttributeNames: {
              "#org": "orgId"
            },
            ExpressionAttributeValues: {
              ":orgId": element.orgId
            }
        };
        let userData = await dynamodb.query(queryParams).promise();

        //condition to check if any manual audience has been configured or not
        let audienceLocList = new Array(), audienceDeptList = new Array(), audienceChnlList = new Array();


        if (element.inProgress !== true) {
            //conditional to check if it is a new campaign to be launched
            for (const tempObj of element.audienceList) {
                if (tempObj.location) {
                audienceLocList.push(tempObj.location);
                }
                if (tempObj.department) {
                audienceDeptList.push(tempObj.department);
                }
                if (tempObj.slackChannel) {
                audienceChnlList.push(tempObj.slackChannel);
                }
                tempObj.status = "processed"; //updating the status of this audience object that is has been processed to help us identify additions to the array if any during the campaign is still running
            }

        } else if (element.inProgress === true && element.campaignStatus === "UPDATED") {
            //condition to check if it is a running campaign where the audience has been updated
            for (const tempObj of element.audienceList) {
                console.log(tempObj);
                if (tempObj.status === "new") {
                if (tempObj.location) {
                    audienceLocList.push(tempObj.location);
                }
                if (tempObj.department) {
                    audienceDeptList.push(tempObj.department);
                }
                if (tempObj.slackChannel) {
                    audienceChnlList.push(tempObj.slackChannel);
                }
                tempObj.status = "processed"; //updating the status of this audience object that is has been processed to help us identify additions to the array if any during the campaign is still running
                }
            }
        }
        else {
            //we skip to the next campaign if it does not fall in these two categories
            return [];
        }
       
        if (audienceDeptList[0] && audienceDeptList[0] !== undefined && audienceDeptList[0] != null) {
            audienceDeptList = audienceDeptList[0];
        }
        if (audienceLocList[0] && audienceLocList[0] !== undefined && audienceLocList[0] != null) {
            audienceLocList = audienceLocList[0];
        }

        //below loops are to filter out the user list on the basis of the custom audience
        if (audienceDeptList.length > 0 && audienceLocList.length > 0) {
            for (const userElement of userData.Items) {
                if (audienceLocList.indexOf(userElement.location) > -1 && audienceDeptList.indexOf(userElement.department) > -1) {
                    filteredUserList.push(userElement);
                }
            }
        }
        else if (audienceDeptList.length > 0) {
            for (const userElement of userData.Items) {
                if (audienceDeptList.indexOf(userElement.department) > -1) {
                    filteredUserList.push(userElement);
                }
            }
        }
        else if (audienceLocList.length > 0) {
            for (const userElement of userData.Items) {
                if (audienceLocList.indexOf(userElement.location) > -1) {
                    filteredUserList.push(userElement);
                }
            }
        }
        else if (audienceChnlList.length > 0) {
            for (const channelId of audienceChnlList) {
                const options = {
                    host: 'slack.com',
                    path: '/api/conversations.members?channel=' + channelId,
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + slackToken
                    }
                };
                const chdata = await getSlackChUsers(options);
                const chmembers = JSON.parse(chdata.body).members;
                for (const member of chmembers) {
                    //TODO - should be do this user fetch via the employee index, it would be faster?
                    queryParams = {
                        TableName: userTableName,
                        KeyConditionExpression: "#org = :orgId",
                        ExpressionAttributeNames: {
                            "#org": "orgId"
                        },
                        FilterExpression: "commId = :userCommId",
                        ExpressionAttributeValues: {
                            ":orgId": element.orgId,
                            ":userCommId": member
                        }

                    };
                    let userData = await dynamodb.query(queryParams).promise();
                    for (const userElement of userData.Items) {
                        filteredUserList.push(userElement);
                    }
                }
            }

        }
        else {
            //case when no audience is selected, we fill all users
            for (const userElement of userData.Items) {
                filteredUserList.push(userElement);
            }
        }
    }

    return filteredUserList;
};

const updateUserCampaignDetails = async function (element,userId,userTableName) {
    let queryParams = {
        TableName: userTableName,
        Key: {
          "orgId": element.orgId,
          "userId": userId
        },
        UpdateExpression: "SET campaignId = :campaignId, campaignFocusArea = :campaignFocusArea, campaignStatus =:campaignStatus, lastProcessedDate =:currentDate, nextCampaignQuestion = :nextQuestionToPickId,  nextBundleTriggerDate = :nextBundleTriggerDate , reminderCount =:reminderCount",
        ExpressionAttributeValues: {
          ":campaignId": element.campaignId,
          ":campaignFocusArea": element.focusArea,
          ":campaignStatus": 'INITIATED',
          ":currentDate": + new Date(),
          ":nextQuestionToPickId": '',
          ":reminderCount" : 0,
          ":nextBundleTriggerDate": new Date("2000-01-01").toISOString() //TODO
        }
      };
      await dynamodb.update(queryParams).promise();
};

const updateCampaign = async function (element,campaignTableName) {
    let queryParams = {
        TableName: campaignTableName,
        Key: {
          "orgId": element.orgId,
          "campaignId": element.campaignId
        },
        UpdateExpression: "SET inProgress = :inProgress, reminderCount=:reminderCount, lastProcessedDate =:currentDate, campaignStatus = :status_text, audienceList = :audList",
        ExpressionAttributeValues: {
          ":inProgress": true,
          ":currentDate": + new Date(),
          ":reminderCount": 0,
          ":status_text": 'INITIATED', //using this as a flag to distinguish if audience is edited post campaign is launched
          ":audList": element.audienceList
        }
      };
      await dynamodb.update(queryParams).promise();
};

module.exports = {
    campaignDateCheck,
    computeFilteredUserList,
    updateUserCampaignDetails,
    updateCampaign
};