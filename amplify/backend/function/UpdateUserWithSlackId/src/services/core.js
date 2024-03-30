/**This file hosts all services for the REST Handles */
const { listAllOrgDetails,updateOrg } = require('@dbutils/orgEntity');
const { fetchUsersOfOrgByAttribute, updateUserToDB } = require('@dbutils/user');


const { getUserFromSlack,getBotCallbackId } = require('@commonutils/slackUtils');
const { sendSlackPing } = require('./messaging');


/**
 * Function to fetch all users and send introduction after getting slack id for new users
 * @returns 
 */
const updateSlackIdsForAllOrg = async function () {

    const orgDetails = await listAllOrgDetails(["orgId", "slackToken", "orgReminders","lastProcessedDate","callbackId"]);

    if (orgDetails) {

        for (const org of orgDetails) {
  
            if (org.slackToken && org.orgReminders?.includes(new Date().getHours())) {
                let orgUsers = await fetchUsersOfOrgByAttribute(org.orgId, ["userId", "commId", "userEmail"]);

                let emailArray = [];
                for (const user of orgUsers) {
                    //only if role exists and slackId does not exist
                    if (!user.commId ) {
                        emailArray[user.userEmail] = user.userId;

                    }

                }

                const orgUserList = await getUserFromSlack(org.slackToken);

                const callbackId = await updateUserWithSlackUsersIdAndPostSlack(org, emailArray, orgUserList,org.slackToken);
                let updateJSON = {
                    lastProcessedDate: new Date().toISOString()
                };
                if (!org.callbackId && callbackId)
                {
                    updateJSON.callbackId = callbackId;
                }
                await updateOrg({orgId: org.orgId},updateJSON);

            }

        }
    }
}

const updateUserWithSlackUsersIdAndPostSlack = async function (org, emailArray, orgUserList,token) {

    let callbackId = org.callbackId;
    if(!callbackId){
        callbackId = await getBotCallbackId(token);
    }
    let promiseArray = [];
    for (const slackProfile of orgUserList) {
        if (slackProfile.profile.email) {
            const lowerCaseEmail = slackProfile.profile.email.toLowerCase();
            if (emailArray[lowerCaseEmail]) {
                promiseArray.push(updateUserToDB(
                    org.orgId,  emailArray[lowerCaseEmail] ,
                    { commId: slackProfile.id })
                );
                promiseArray.push(sendSlackPing(slackProfile.id, org,token,callbackId));
            }
        }
    }
    await Promise.all(promiseArray);
    return callbackId;
}


module.exports = {
    updateSlackIdsForAllOrg
}