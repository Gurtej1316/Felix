const { MessageFactory, CardFactory} = require('botbuilder');
const { MicrosoftAppCredentials, ConnectorClient } = require('botframework-connector');
const { SecretKeys } = require('@commonutils/secretManager');

let connectorClient;
const AWS = require('aws-sdk');
const secretsManager = new AWS.SecretsManager();


/**
 * Function to create adaptive card using display name and value in messageMap
 * @param {*} messageMap 
 * @param {*} introMessage
 * @returns
 */
async function createTeamsAdaptiveCard(messageMap, introMessage){
    let messageBody =  [{
        "type": "TextBlock",
        "text": introMessage,
        "wrap": true
    }];

    if(messageMap){
        for(let messageObj of messageMap){
            let actionSet = {
                "type": "ActionSet",
                "actions": [
                    {
                        "type": "Action.Submit",
                        "title": messageObj.displayName,
                         "data": { "buttonData": messageObj.value }
                    }
                ]
            }
            messageBody.push(actionSet);
        }
    }
  
    let messageAttachment = {
        "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
        "type": "AdaptiveCard",
        "version": "1.5",
        "body": messageBody
    };

return messageAttachment
};

/**
 * Function to fetch secret value using secrets manager
 * @param {*} secretName - Name of secret
 * @param {*} secretAppend - Key to fetch secret value
 * @returns
 */
 async function getSecretValue(secretName, secretAppend) {
    var secretId = secretAppend + "-" + process.env.ENV;
    const secret = await secretsManager.getSecretValue({ SecretId: secretName }).promise();
    if (secret && secret.SecretString) {
        var secretData = JSON.parse(secret.SecretString);
        var secretValue = secretData[secretId];
        if (secretValue === undefined) {
            secretId = secretAppend + "-" + "stage";
            secretValue = secretData[secretId];
        }
    }
    return secretValue;
}

/**
 * Function to send
 * @param {*} tenantId - orgId in DB
 * @param {*} commId - commId of user
 * @param {*} serviceUrl - location specific service URL of user
 * @param {*} messageMap - Map of display name and value to create adaptive card
 * @param {*} MessageType - Message type(can be Card or Text)
 * @param {*} introMessage - Message to be send with card
 * @returns
 */
async function sendUserMessage(tenantId, commId, serviceUrl, messageMap ,MessageType, introMessage) { 
    MicrosoftAppCredentials.trustServiceUrl(serviceUrl);
    const botClientID = await getSecretValue(SecretKeys.TEAMS_APP_CLIENT_ID, SecretKeys.TEAMS_APP_CLIENT_ID);
    const botClientSecret = await getSecretValue(SecretKeys.TEAMS_APP_CLIENT_SECRET, SecretKeys.TEAMS_APP_CLIENT_SECRET);
     
    const credentials = new MicrosoftAppCredentials(botClientID, botClientSecret);
    const connectorClient = new ConnectorClient(credentials, { baseUri: serviceUrl });
    console.log("connector client initialized");
    let message;
    if(MessageType == 'Card'){
        const messageAttachment = await createTeamsAdaptiveCard(messageMap, introMessage);
        message = MessageFactory.attachment(CardFactory.adaptiveCard(messageAttachment));
    }
    else{
        message = MessageFactory.text(messageMap);
    }

    const conversationParameters = { 
        isGroup: false,
        channelData: {
            tenant: {
                id: tenantId
            }
        },
        members: [
            {
                id: commId
            }
        ]
    };

    
    let response = await connectorClient.conversations.createConversation(conversationParameters);

    await connectorClient.conversations.sendToConversation(response.id, message)
        .then(result => {
            console.log(" Sent initial ping to teams user");
        })
        .catch(err => console.error(`Error doing the request  sendToConversation => ${err}`));
}

async function sendChannelMessage(messageTxt) {

    let message = MessageFactory.text(messageTxt);
    // Channel Scope
    const conversationParameters = {
        isGroup: true,
        channelData: {
            channel: {
                id: process.env.TEAMS_CHANNEL_ID
            }
        },
        activity: message
    };
    console.log("conversationParameters-",conversationParameters)
    await connectorClient.conversations.createConversation(conversationParameters)
        .then(result => {
            console.log(" Sent initial ping to teams user for the campaign");

        })
        .catch(err => console.error(`Error doing the request for the event: => ${err}`));
    // Send reply to channel
    message = MessageFactory.text("This is the first reply in a new channel message");
    await connectorClient.conversations.sendToConversation(response.id, message);
    console.log("channel message sent");
}

module.exports = {
    sendChannelMessage,
    sendUserMessage,
    getSecretValue,
  }
