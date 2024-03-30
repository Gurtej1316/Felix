/**This file hosts all services for sending the messaging across channel types */
const { listAllOrgDetails, updateOrg } = require('@dbutils/orgEntity');
const { fetchUsersOfOrgByAttribute, updateUserToDB } = require('@dbutils/user');
const { postSlackSectionsToUserWithOneButton } = require('@commonutils/slackUtils');
const { getUserFromSlack, getBotCallbackId } = require('@commonutils/slackUtils');
const { CommChannels, MessageIntro, CountryCode } = require('@commonutils/constants');
const { sendSingleEmailWithTemplate } = require('@commonutils/emailService');
const { RetrieveSecret, SecretKeys } = require('@commonutils/secretManager');


/**
 * Function to fetch all users and send introduction from Berry if not already sent
 * @returns 
 */
const sendIntroMessageToUsers = async function () {
    const orgDetails = await listAllOrgDetails(["orgId", "slackToken", "accessToken", "orgReminders", "lastProcessedDate", "callbackId", "createdDate"]);
    if (orgDetails) {
        for (const org of orgDetails) {
            if (org.orgId) {
                let introMsg = await setIntroMessage(org);
                let orgUsers = await fetchUsersOfOrgByAttribute(org.orgId, ["userId", "firstName", "commId", "userEmail", "commChannel", "phoneNumber", "introMessageSent"]);
                let updateJSON = {
                    lastProcessedDate: new Date().toISOString()
                };
                let emailArray = [];
                for (const user of orgUsers) {
                    if (!user.introMessageSent) {
                        if (user.commChannel && org.slackToken && user.commChannel == CommChannels.SLACK) {
                            if (!user.commId) {
                                emailArray[user.userEmail] = user.userId;
                            }
                            else {
                                if (org.callbackId) {
                                    await sendSlackPing(user.commId, org.slackToken, org.callbackId, introMsg);
                                }
                                else {
                                    console.log("org does not have call back id!");
                                }
                            }
                        }
                        else if (user.commChannel && user.commChannel == CommChannels.EMAIL) {
                            let templateData = {
                                "firstName": user.firstName || "",
                                "message": "Hi!"+introMsg,
                            };
                            await sendSingleEmailWithTemplate("connect@berryworks.ai", user.userEmail, "Berry-Introduction-Template", templateData);

                        }
                        else if (user.commChannel && user.commChannel == CommChannels.SMS) {
                            await sendSmsPing(user, "Hi!"+introMsg);

                        }
                        else {
                            console.log("comm channel is either Teams/null");
                        }
                        updateUserToDB(org.orgId, user.userId, { introMessageSent: true });
                    }
                    else{
                        console.log("intro message already sent to user!", user.userId);
                    }
                }

                if (org.slackToken && emailArray) {
                    const orgUserList = await getUserFromSlack(org.slackToken);
                    const callbackId = await updateUserWithSlackUsersIdAndPostSlack(org, emailArray, orgUserList, org.slackToken, introMsg);

                    if (!org.callbackId && callbackId) {
                        updateJSON.callbackId = callbackId;
                    }
                }
                await updateOrg({ orgId: org.orgId }, updateJSON);
            }
        }
    }
}

/**
 * Function to update user with comm Id if commChannel is slack
 * @param {*} org
 * @param {*} emailArray 
 * @param {*} orgUserList
 * @param {*} token
 * @param {*} introMsg
 * @returns 
 */
const updateUserWithSlackUsersIdAndPostSlack = async function (org, emailArray, orgUserList, token, introMsg) {
    let callbackId = org.callbackId;
    if (!callbackId) {
        callbackId = await getBotCallbackId(token);
    }
    let promiseArray = [];
    for (const slackProfile of orgUserList) {
        if (slackProfile.profile.email) {
            const lowerCaseEmail = slackProfile.profile.email.toLowerCase();
            if (emailArray[lowerCaseEmail]) {
                promiseArray.push(updateUserToDB(
                    org.orgId, emailArray[lowerCaseEmail],
                    { commId: slackProfile.id })
                );
                promiseArray.push(sendSlackPing(slackProfile.id, token, callbackId, introMsg));
            }
        }
    }
    await Promise.all(promiseArray);
    return callbackId;
}


/**
 * Function to set the intro message
 * @param {*} organization - org details 
 * @returns 
 */
const setIntroMessage = async function (organization) {
    let intro = MessageIntro.NEW_ORG_USER_INTRO;
    if (organization.lastProcessedDate) {
        intro = intro + " I have been in service to your team since " +  new Date(organization.createdDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) +". You recently got added to the team.";
    }
    else {
        intro = intro+" Your slack admin just installed me.";
    }

    intro = intro + " So I wanted to reach out and say hello.";
    return intro;
}

/**
 * Function to set the intro message
 * @param {*} slackUserId
 * @param {*} introMsg - org details 
 * @param {*} token
 * @param {*} callbackId
 * @returns 
 */
const sendSlackPing = async function (slackUserId, token, callbackId, introMsg) {
    let intro = "Hi<@" + slackUserId + ">." + introMsg;
    let messageMap = {
        intro: intro,
        callbackId: callbackId,
        sections: []
    }
    await postSlackSectionsToUserWithOneButton(slackUserId, messageMap, token);
}

/**
 * function to send message to user with Twilio programmable SMS
 * @param {*} userObj 
 */
 const sendSmsPing = async function (userObj, message){
    if(userObj.phoneNumber){
        let phoneNumber = userObj.country ? CountryCode[userObj.country.toUpperCase()]+userObj.phoneNumber : CountryCode.US+userObj.phoneNumber;
        const twilioAccount = await getTwilioAccountInfo();
        if (twilioAccount && twilioAccount.TWILIO_SID && twilioAccount.TWILIO_AUTH_TOKEN) {
            const client = require('twilio')(twilioAccount.TWILIO_SID, twilioAccount.TWILIO_AUTH_TOKEN);
            client.messages.create({
                body: message,
                from: twilioAccount.TWILIO_NUMBER,
                to: phoneNumber //Eg: '+12012455396'   
                }).then(message => console.log(message.sid))
                .catch(err => console.error(`Error sending SMS: `, err));
        }
    }
};

/**
 * Function to get TWILIO_ACCOUNT_VARIABLES from the secret manager
 * @returns 
 */
 const getTwilioAccountInfo = async function () {
    return await RetrieveSecret(SecretKeys.TWILIO_ACCOUNT_VARIABLES);
}

module.exports = {
    sendIntroMessageToUsers
}
