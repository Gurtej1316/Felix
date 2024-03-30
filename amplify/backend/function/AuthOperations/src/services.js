/** This file hosts service function for the lambda function */
const AWS = require('aws-sdk');
AWS.config.update({ region: process.env.TABLE_REGION });
const dynamodb = new AWS.DynamoDB.DocumentClient();
const { ResponseFormatter, ERRORS } = require('@commonutils/formatter');
const { getOrgDetails } = require('@dbutils/org');
const { getFilteredEmployees } = require('@searchutils/employees');

let userTableName = "OrgUser";
let roleTableName = "OrgRolePermissions";
if(process.env.ENV && process.env.ENV !== "NONE") { 
  userTableName = userTableName + '-' + process.env.ENV;
  roleTableName = roleTableName + '-' + process.env.ENV;
}

/**
 * Function to fetch org details using orgname passed in url//
 * @param {*} orgIdentifier 
 * @returns
 */
const fetchOrgDetails = async function(orgIdentifier) {

    try {

        if(!orgIdentifier) {
            console.error('Malformed Request. orgIdentifier not present.');
            return ResponseFormatter(null, ERRORS.BAD_REQUEST);
        }

        let response = {
            sso: null, 
            orgId: null,           
        };
        const orgDetails = await getOrgDetails("orgIdentifier", orgIdentifier);
        let orgItems = orgDetails.Items[0];

        if(orgDetails){
        if(orgDetails.Items && orgItems && orgItems.orgId){
            response.orgId = orgItems.orgId;
            response.userPoolId = orgItems.userPoolId;  
            response.appClientId = orgItems.appClientId;
            if(orgItems.commChannel){
                response.commChannel = orgItems.commChannel;
            }    
            if(orgItems.ssoProvider) {
            response.sso = orgItems.ssoProvider;
            }
        }
        }
   
        console.log('Printing Response',JSON.stringify(response))
        return ResponseFormatter(response);
        } catch (error) {
        console.log(error);        
        return ResponseFormatter(null, ERRORS.INTERNAL_ERROR);
    }

}

/**
 * Function to fetch org details using orgname passed in url//
 * @param {*} email 
 * @returns 
 */

const fetchUserData = async function(email) {
    let orgId;
    let searchCond
    if(email){
        searchCond = [{ match: { "email.keyword": email }}];
        let userData = await getFilteredEmployees(orgId,searchCond);
        let profileData ={
            name: null,
            commId: null,
            orgId: null,
            userPermissions: null,
            userRole: null
        };
        if(userData && userData.length>0){
            console.log("userData: ", userData);
            profileData.userCount = 1;
            let lastName = userData[0].lastName?" "+userData[0].lastName:"";
            profileData.name = userData[0].firstName + lastName;
            profileData.orgId = userData[0].orgId
            profileData.commId = userData[0].commId ? userData[0].commId : null;
            if(userData[0].userRole)
            {
              profileData.userRole = userData[0].userRole;   
            }
            else
            {
              let role = await updateUserTableWithRole(userData[0].orgId, userData[0].userId);
              console.log("role: ", role);
              profileData.userRole = role;
            }
            let userPermission = await getUserPermissions(userData[0].orgId, profileData.userRole);
            if(userPermission){
                profileData.userPermissions = userPermission
            }            
          
        }console.log("profileData: ", profileData);
        return ResponseFormatter(profileData);
    }
}

async function getUserPermissions(orgId, userRole){
    let queryParams = {
        TableName: roleTableName,
        FilterExpression: "#org = :orgId and #roleAttribute = :userRole",
        ExpressionAttributeNames: {
            "#org": "orgId",
            "#roleAttribute" : "userRole"
        },
        ExpressionAttributeValues: {
            ":orgId": orgId,
            ":userRole": userRole
        }
    };
    roleData = await dynamodb.scan(queryParams).promise(); 
    console.log("roleData: " + JSON.stringify(roleData));        
    if(roleData && roleData.Items && roleData.Items.length>0 && roleData.Items[0].userPermissions)
    {          
        return roleData.Items[0].userPermissions;
    }
    else
    {
        return ["Dashboard_Sentiment_Score","Dashboard_Sentiment_Trend"];          
    } 
}

async function updateUserTableWithRole(orgId, userId){
    let updateUserParams = {
        TableName: userTableName,
        Key: {
          "orgId": orgId,
          "userId": userId
        },
        UpdateExpression: 'SET #userRole = :uRole',
        ExpressionAttributeNames:{
          "#userRole": "userRole"
        },
        ExpressionAttributeValues: {
          ':uRole' : 'Employee'
        }
    };
    console.log("Updating the user table with default role as Employee"); 
    await dynamodb.update(updateUserParams).promise();
    return 'Employee';
}

module.exports = {
    fetchOrgDetails,
    fetchUserData
}