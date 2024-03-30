
const { postSlackSectionsToUserWithOneButton } = require('@commonutils/slackUtils');
const teamsService = require('@communicationutils/teamsServices');
const { RetrieveSecret, SecretKeys } = require('@commonutils/secretManager');
const { MessageIntro, CountryCode } = require('@commonutils/constants');

/**
 * function to send reminder message for FAQ in slack
 * @param {*} orgObj 
 * @param {*} userObj 
 */
const sendReminderInSlack = async function (orgObj, userObj) {

    let introMsg = "Hi <@" + userObj.commId + ">. "+ MessageIntro.FAQ_REMINDER;
    let messageMap = {
        intro: introMsg,
        callbackId: orgObj.callbackId,
        sections: []
    };
    await postSlackSectionsToUserWithOneButton(userObj.commId, messageMap, orgObj.slackToken);

};

/**
 * function to send message to user with Twilio programmable SMS
 * @param {*} userObj 
 */
const sendReminderSms = async function (userObj) {
    if (userObj.phoneNumber) {
        console.log("Inside sendReminderSms", userObj.firstName, userObj.phoneNumber);
        let phoneNumber = userObj.country ? CountryCode[userObj.country.toUpperCase()]+userObj.phoneNumber : CountryCode.US+userObj.phoneNumber;
        const twilioAccount = await getTwilioAccountInfo();
        if (twilioAccount && twilioAccount.TWILIO_SID && twilioAccount.TWILIO_AUTH_TOKEN) {
            const client = require('twilio')(twilioAccount.TWILIO_SID, twilioAccount.TWILIO_AUTH_TOKEN);
            await client.messages.create({
                body: "Hi there, " + MessageIntro.FAQ_REMINDER,
                from: twilioAccount.TWILIO_NUMBER,
                to: phoneNumber
                }).then(message => console.log("Message sent successfully. SID-",message.sid))
                .catch(err => console.error(`Error doing the request for the event: `, err));
        }
    }
    else{
        console.log("Inside sendReminderSms, user has no phone number attribute")
    }
};

/**
 * Function to get TWILIO_ACCOUNT_VARIABLES from the secret manager
 * @returns 
 */
const getTwilioAccountInfo = async function () {
    return await RetrieveSecret(SecretKeys.TWILIO_ACCOUNT_VARIABLES);
}

/**
 * function to send reminder message for FAQ in Teams
 * @param {*} userObj 
 */
const sendReminderInTeams = async function (userObj) {
    if(userObj.commId && userObj.serviceUrl){
        console.log("Inside sendReminderInTeams", userObj.firstName, userObj.commId);
        let messageType = 'Text';
        let message = "Hi there, "+ MessageIntro.FAQ_REMINDER;
        await teamsService.sendUserMessage(userObj.orgId, userObj.commId, userObj.serviceUrl, message, messageType, null)
            .then(async result => {
                console.log(" Sent ping to teams user", userObj.firstName);
    
            })
            .catch(err => console.error(`Error doing the request for the event: `, err));
    }
}

module.exports = {
    sendReminderInSlack,
    sendReminderSms,
    sendReminderInTeams
};