/**This file hosts all services for sending the messaging across channel types */

const {
    postSlackSectionsToUserWithOneButton
} = require('@commonutils/slackUtils');


/**
 * Function sends slack ping to the user with the customers they have
 * @returns 
 */
const sendSlackPing = async function (slackUserId, organization, token,callbackId) {

    let intro ="Hi<@"+slackUserId+">. I'm Berry, your personal employee voice assistant. My job is to listen to you and facilitate employee driven change inside the organization. You can know more about me at `https://www.berryworks.ai`.";
    if(organization.lastProcessedDate)
    {
        intro = intro+" I have been in service to your team since " +
        new Date(organization.lastProcessedDate).toLocaleDateString('en-US',{ weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) +
        ". You recently got added to the team."
    }
    else
    {
        intro = " Your slack admin just installed me."
        
    }
    
    intro = intro + " So I wanted to reach out and say hello."
    
    let messageMap = {
        intro:intro,
        callbackId: callbackId,
        sections: []
    }
 
   

    messageMap.sections.push({
        index: 0,
        heading: "Just ask.",
        text: "`What can you do for me?` and I can give you some tips.",
        buttonName: "What can you do for me?",
        buttonValue: "What can you do for me"
    });
   
    await postSlackSectionsToUserWithOneButton(slackUserId, messageMap, token);

}



module.exports = {
    sendSlackPing
}