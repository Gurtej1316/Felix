/**This file hosts all services for the REST Handles */
var _ = require('lodash');
const { ResponseFormatter, ERRORS } = require('@commonutils/formatter');
const { OrgPricingType, TableNames } = require('@commonutils/constants');
const { getOrgAttribute, getOrgDetails } = require('@dbutils/org');
const { getDistinctEmpAttributeValues, getFilteredEmployeesCount, getFilteredEmployees, getCoverage } = require('@searchutils/employees');
const { setElasticFilterQuery } = require('@searchutils/services');
const { getChannelsForUser,getMembersOfChannel,getUserInfoFromCommId } =  require('@communicationutils/slackServices');
const { insertUserToDB,fetchUsersOfOrgByAttribute,fetchUsersOfOrg } = require('@dbutils/user');
const { insertUpdateOrg } = require('@dbutils/orgEntity');
const { insertDefaultData} = require('@commonutils/services');
const { Permissions } = require('@commonutils/permissions');

/**
 * Function to fetch unique values to populate the audience configuration drop downs
 * @param {*} orgId 
 * @returns 
 */
const fetchUniqueValues = async function (orgId) {

    try {
        const getParams = 'campaignAudienceAttributes';
        const response = await getOrgAttribute(orgId, getParams);
        // console.log("Org response: ",JSON.stringify(response,null,3));
        let returnArray = [];
        let promiseArray = [];
        let arrayIndex = 0;

        if (response.Item && response.Item.campaignAudienceAttributes) {

            for (const index in response.Item.campaignAudienceAttributes){
                returnArray[arrayIndex] = response.Item.campaignAudienceAttributes[index];
                promiseArray[arrayIndex] =  getDistinctEmpAttributeValues(orgId,returnArray[arrayIndex].key);
                arrayIndex++; 
            }
            
            const uniqueValuesArray = await Promise.all(promiseArray);

            for (const index in returnArray){
                returnArray[index].uniqueValues = _.compact(uniqueValuesArray[index].map(item => item[returnArray[index].key]));
            }

            // console.log("Org response: ",JSON.stringify(returnArray,null,3));
            return ResponseFormatter(returnArray);
        }
        //returning blank list if no org level attribute set for "campaignAudienceAttributes"
        return ResponseFormatter(returnArray);
    } catch (error) {
        console.error(error);
        return ResponseFormatter(null, ERRORS.NOT_FOUND);
    }

}


/**
 * Function to fetch coverage on dashboard
 * @param {*} orgId 
 * @returns 
 */
 const fetchCoverage = async function (orgId) {
    let coverage = 0;
    try {
        let response = await getCoverage(orgId);
        if(response){
            console.log("response in fetchCoverage - ",JSON.stringify(response,null,3));
            if(response.TotalUsersCount && response.TotalUsersCount.value && response.TotalUsersCount.value != 0 && 
                    response.TotalInteractedCount && response.TotalInteractedCount.count && response.TotalInteractedCount.count.value){
                coverage = ((response.TotalInteractedCount.count.value / response.TotalUsersCount.value)*100).toFixed(0);
            }
        }
        return ResponseFormatter(coverage);
    } catch (error) {
        console.error(error);
        return ResponseFormatter(null, ERRORS.NOT_FOUND);
    }
}


/**
 * Function to check if the filtered audience count is above the ORG's audienceLimit before launching a campaign
 * @param {*} orgId
 * @param {*} audiences //list of audience combinations 
 * @returns 
 */
 const checkAudienceThresholdForCampaign = async function (orgId,audiences) {

    try {
        const getParams = 'audienceLimit';
        const audienceThreshold = await getOrgAttribute(orgId, getParams);
        // console.log("audienceThreshold: ",audienceThreshold);

        let totalAudienceCount = 0;
        if(audiences.length > 0){
            for(var tempObj of audiences){
                delete tempObj.status;
                const updatedFilterQuery = await setElasticFilterQuery(tempObj);
                let empCount = await getFilteredEmployeesCount(orgId, updatedFilterQuery);
                // console.log("empCount",empCount);
                totalAudienceCount += empCount ? empCount : 0;
            }
        }else{
            //case when no audience is specified - take the entire org size
            let empCount = await getFilteredEmployeesCount(orgId, []);
            totalAudienceCount = empCount ? empCount : 0;
        }

        console.log("Inside checkAudienceThresholdForCampaign() - totalAudienceCount: ",totalAudienceCount);
        if(totalAudienceCount < audienceThreshold.Item.audienceLimit){
            return false;
        }else{
            return true;
        }
        
    } catch (error) {
        console.error(error);
        return false;
    }
};

/**
 * Function to fetch and save users of a channel to the db
 * @param {*} orgId
 * @param {*} channelObj 
 * @returns 
*/
const saveUsersForChannel = async function (orgId,channelObj) {
    // console.log("Inside saveUsersForChannel()",orgId,channelObj);
    let memberCommIds = await getMembersOfChannel(orgId,channelObj.channelId);
    console.log("Inside saveUsersForChannel() - memberCommIds: ",JSON.stringify(memberCommIds));
    
    //check which of these already exist and skip those
    //fetch user details using orgId and commId
    if(memberCommIds){
        let searchCond = [];
        let filterValues = {};
        filterValues['commId'] = memberCommIds;
        
        for (let [key, value] of Object.entries(filterValues)) {
            
            const parsedValue = value;
            let searchterm;
            
            if(parsedValue.length){
                let shouldTerm =[];
                parsedValue.forEach(element=>{
                    let matchObject={};
                    
                    matchObject[key+".keyword"] = element;
                    shouldTerm.push({
                            match: matchObject
                    });
                });
                
                searchterm = {
                    bool: {
                        should: shouldTerm
                    }
                }               
            }
            else{
                let matchObject={};
                matchObject[key+".keyword"]= parsedValue ;
                    searchterm = {
                    match: matchObject
                }
            }                            
            searchCond.push(searchterm);
            
        }
        let userData = await getFilteredEmployees(orgId,searchCond);
        console.log("UserData",userData);
        let commIdsToSkip = [];
        for(const userObj of userData){
            commIdsToSkip.push(userObj.commId);
        }
        console.log("commIdsToSkip",commIdsToSkip);
        //process each comm id
        for(const commId of memberCommIds){
            if(commIdsToSkip.indexOf(commId) == -1){
                let userDetail = await getUserInfoFromCommId(orgId,commId);
                console.log("In saveUsersForChannel() - userDetail",JSON.stringify(userDetail));
                if(userDetail && userDetail.profile){
                    userDetail = userDetail.profile;
                    let userObjToSave = {};

                    //name
                    if(userDetail.first_name && userDetail.last_name){
                        //if these fields exist
                        userObjToSave.firstName = userDetail.first_name;
                        userObjToSave.lastName = userDetail.last_name
                    } else if(userDetail.real_name){
                        //if not, then extract from real_name
                        let splitStr = userDetail.real_name.split(" ");
                        userObjToSave.firstName = splitStr[0];
                        userObjToSave.lastName = splitStr[1];
                    }

                    //email
                    if(userDetail.email){
                        userObjToSave.userEmail = userDetail.email;
                        userObjToSave.userId = userDetail.email; //setting email as userId
                    }
                    //commId
                    userObjToSave.commId = commId;
                    userObjToSave.commChannel = "Slack"; //TODO - right now it is hardcoded to Slack

                    //phone
                    if(userDetail.phone){
                        let formattedNumber = userDetail.phone.replace(/[^a-zA-Z0-9]/g, '');
                        userObjToSave.contactNumber = Number(formattedNumber);
                    }

                    if(userObjToSave.userId){
                        //if userId is set as email - we will save the user
                        let returnInsertUser = await insertUserToDB(orgId,userObjToSave);
                        console.log("Inserting user",returnInsertUser);

                    }else{
                        console.log("No email for user hence cannot save",JSON.stringify(userDetail));
                    }

                }
            }
        }
    }

    return ResponseFormatter([]);
};

/**
 * Function to fetch slack channels for an ORG
 * @param {*} orgId 
 * @returns 
*/
const fetchSlackChannelsForUser = async function (orgId,commId) {
    let searchCond = [];
    searchCond.push({ match: { "commId": commId } });
    let userData = await getFilteredEmployees(orgId,searchCond);
    userData = userData && userData[0] ? userData[0] : undefined; //setting userData[0] to userData for better readability for the rest of the code
    console.log("userData in fetchSlackChannelsForUser",JSON.stringify(userData));
    let resp = await getChannelsForUser(orgId,userData);
    return ResponseFormatter(resp);
};


/**
 * Function to fetch users with specific list of attributes
 * @param {*} orgId 
 * @param {*} attributes
 * @returns 
*/
const getUsersWithSpecificAttributes = async function (orgId,attributes) {
    console.log("Inside getUsersWithSpecificAttributes",orgId,attributes);
    let resp;
    if(attributes && attributes.length > 0){
        resp = await fetchUsersOfOrgByAttribute(orgId,attributes);
    }else{
        //if the attributes list is empty or undefined
        resp = await fetchUsersOfOrg(orgId);
    }
    return ResponseFormatter(resp);
};

/**
 * Function to register new user in cognito user pool
 * @param {*} clientId 
 * @param {*} userName
 * @param {*} userEmail
 * @param {*} userPassword
 * @param {*} cognitoidentityserviceprovider
 * @returns 
*/
const registerUser = async function (clientId, userName, userEmail, userPassword, cognitoidentityserviceprovider) {
    let msg = "";
    let orgId;
    let regUser = true;
    var userOrgDomain = userEmail.split("@")[1];
    const orgDetails = await getOrgDetails("domain", userOrgDomain);
    if(orgDetails && orgDetails.Items.length>0){
        console.log('org Exists');
        let orgData = orgDetails.Items[0];
        orgId = orgData.orgId;
        if(orgData.orgPricingType == OrgPricingType.ENTERPRISE){
            msg = "Your organization is already a customer. Our sales team will be in touch with you to coordinate access."
            regUser = false;
        }
    }
    else{
        orgId = await insertUpdateOrg({
            "orgName": userEmail.split("@")[1].split(".")[0],
            "orgPricingType": OrgPricingType.FREE,
            "createdDate": new Date().toISOString(),
            "domain": userOrgDomain
        });
        await insertDefaultData(orgId, TableNames.ROLEPERMISSIONS, [{
            "roleId": "Guest User",
            "userRole": "Guest User",
            "userPermissions": [Permissions.VIEW_INSIGHTS_PERMISSION],
            "description": "Guest user dashboard insights permission"
        }]);
        console.log("org does not exist")
    }
    if(regUser){
        var params = {
            ClientId: clientId, /* required */
            Password: userPassword, /* required */
            Username: userEmail, /* required */
            AnalyticsMetadata: {},
            ClientMetadata: {},
            UserAttributes: [{ Name: "name", Value: userName }, { Name: "email", Value: userEmail }],/* required */
            UserContextData: {},
            ValidationData: [{ Name: "name", Value: userName }, { Name: "email", Value: userEmail }]/* required */
        };
        try {
            await cognitoidentityserviceprovider.signUp(params).promise();
            let returnInsertUser = await insertUserToDB(orgId, {
                "orgId" : orgId,
                "userId": userEmail,
                "firstName": userName.split(" ")[0],
                "lastName": userName.split(" ").shift(),
                "userEmail": userEmail,
                "userRole": "Guest User",
            });
            return ""
        }
        catch (err) {
            console.log("Error registering user-",err);
            return { msg: "Email already exists!" };
        }
    }
    else{
        return { msg: msg };
    }

}

module.exports = {
    fetchUniqueValues,
    fetchCoverage,
    checkAudienceThresholdForCampaign,
    saveUsersForChannel,
    fetchSlackChannelsForUser,
    getUsersWithSpecificAttributes,
    registerUser
}
