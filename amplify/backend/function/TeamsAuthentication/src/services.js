
const AWS = require('aws-sdk');
AWS.config.update({ region: process.env.TABLE_REGION });

const dynamodb = new AWS.DynamoDB.DocumentClient();
const dbUtils = require('@dbutils/services');
const axios = require('axios');

const { ResponseFormatter, ERRORS } = require('@commonutils/formatter');
const { getOrgAttribute, updateOrg } = require('@dbutils/org');
const { TableNames, CommChannels } = require('@commonutils/constants');
const { updateUserToDB } = require('@dbutils/user');
const { Freemium_Roles, Org_Defaults, Default_Questions, Default_Templates } = require('@commonutils/freemiumConstants');
const { ACCESS_TOKEN_URI, ADMIN_ROLE } = require('./config');
const qs = require('querystring');
const { RetrieveSecretAttribute, SecretKeys } = require('@commonutils/secretManager');
const { doAPICall, createOrgIdentifierFromOrgName,insertDefaultData } = require('@commonutils/services');

/**
 * Function to set User Org Details in DB
 * @param {*} code 
 * @param {*} redirectURI 
 * @param {*} clientTeams 
 * @returns 
 */
const setUserOrgDetails = async function (code, redirectURI, clientTeams) {
    console.log("inside updateorgdetails-", code, redirectURI, clientTeams);
    try {
        const authenticatedData = await getAuthenticatedDataFromCode(code, redirectURI, clientTeams);

        if (authenticatedData && authenticatedData.access_token) {
            const teamsToken = authenticatedData.access_token;
            const tenantData = await getOrgDetails(teamsToken); 
            console.log("tenant data-", tenantData);
            let orgDetails;
            let orgId;
            let orgName;
            if (tenantData && tenantData.body) { 
                orgDetails = JSON.parse(tenantData.body);
                console.log("org Details-", orgDetails);
                orgId = orgDetails["value"][0].id;
                orgName = orgDetails["value"][0].displayName;

                let orgData = await getOrgAttribute(orgId, 'orgId,accessToken,commChannel,orgIdentifier');
                let org;
                if (orgData && orgData.Item) {
                    //CASE - when the ORG exists already - only update access token
                    let updateParams = { accessToken: teamsToken };
                    await updateOrg(orgId, updateParams);
                }
                else {
                    //CASE - when it is a new ORG to be made
                    org = Org_Defaults; 
                    org.commChannel = CommChannels.TEAMS;
                    org.commChannelList.push(CommChannels.TEAMS);
                    org.campaignStartMessages.Teams = org.campaignStartMessages.Slack;
                    delete org.campaignStartMessages.Slack;
                    if (orgName) {
                        let orgIdentifier = await createOrgIdentifierFromOrgName(orgName);
                        org.orgName = orgName;
                        org.orgIdentifier = orgIdentifier;
                    }
                    org.orgId = orgId;
                    org.createdDate = new Date().toISOString();
                    org.accessToken = teamsToken;
                    console.log("Org details in setUserOrgDetails ", org );
                    await insertOrgData(org);
                    await insertDefaultData(orgId, TableNames.ROLEPERMISSIONS, Freemium_Roles);
                    await insertDefaultData(orgId, TableNames.STEP, Default_Questions);
                    await insertDefaultData(orgId, TableNames.WORKFLOW, Default_Templates);
                }

                return ({ commChannel: "Teams" });
            }
            else{
                return ResponseFormatter("Could not fetch tenant data from token", ERRORS.INTERNAL_ERROR);
            }

        }
        else {
            console.error("Could not pull Teams token successfully during installation");
            return ResponseFormatter("Could not pull Teams token successfully during installation", ERRORS.INTERNAL_ERROR);
        }
    } catch (error) {
        console.error(error);
        return ResponseFormatter(null, ERRORS.INTERNAL_ERROR);
    }

};


/**
 * Function to get user profile using Teams access token
 * @param {*} code 
 * @param {*} redirectURI 
 * @param {*} clientTeams 
 * @returns
 */
const fetchUserProfile = async function (code, redirectURI, clientTeams) {
    console.log("inside fetchUserProfile-", code, redirectURI, clientTeams);
    let orgExists = false;
    let profileReturned;
    try {
        const authenticatedData = await getAuthenticatedDataFromCode(code, redirectURI, clientTeams);
        console.log("authenticated data-", authenticatedData);

        if (authenticatedData && authenticatedData.access_token) {
            const tenantData = await getOrgDetails(authenticatedData.access_token);
            let orgId;
            let orgDetails;
            let org;
            if (tenantData && tenantData.body) {
                orgDetails = JSON.parse(tenantData.body);
                orgId = orgDetails["value"][0].id;
                org = await getOrgAttribute(orgId, 'slackToken,commChannel,orgIdentifier');
                if (org && org.Item) {
                    orgExists = true;
                    profileReturned = await getTeamsUserWithToken(authenticatedData.access_token, tenantData);
                    if(profileReturned && profileReturned.orgId){
                        return ({ orgExists: orgExists, profileReturned: profileReturned });
                    }
                    else{
                        return ResponseFormatter("Could not fetch user profile!", ERRORS.INTERNAL_ERROR);
                    }
                }
                else {
                    console.log("Org Id of user doesn not exist in DB!");
                    return ResponseFormatter("Org Id of user doesn not exist in DB!", ERRORS.INTERNAL_ERROR);
                }
            }
            else{
                return ResponseFormatter("Could not fetch tenant data from token", ERRORS.INTERNAL_ERROR);
            }            

        }
        else {
            console.error("Could not pull Teams token successfully during login");
            return ResponseFormatter("Could not pull Teams Token successfully during login", ERRORS.INTERNAL_ERROR);
        }

    } catch (error) {
        console.error(error);
        return ResponseFormatter(null, ERRORS.INTERNAL_ERROR);
    }

};

/**
 * Function to fetch user userPermissions based on userRole
 * @param {*} orgId 
 * @param {*} userRole 
 * @returns 
 */
async function fetchUserPermissions(orgId, userRole) {
    let permissions;
    let queryParams = {
        TableName: TableNames.ROLEPERMISSIONS,
        FilterExpression: "#org = :orgId and #roleAttribute = :userRole",
        ExpressionAttributeNames: {
            "#org": "orgId",
            "#roleAttribute": "userRole"
        },
        ExpressionAttributeValues: {
            ":orgId": orgId,
            ":userRole": userRole
        }
    };
    let roleData = await dynamodb.scan(queryParams).promise();
    if (roleData && roleData.Items.length > 0 && roleData.Items[0].userPermissions) {
        permissions = roleData.Items[0].userPermissions;
    }
    else {
        permissions = [];
    }
    return permissions;
}

/**
 * Function to insert org data into DB
 * @param {*} orgData 
 */
async function insertOrgData(orgData) {
    let putItemParams = {
        TableName: TableNames.ORG,
        Item: orgData
    };
    await dynamodb.put(putItemParams).promise();
}

/**
 * Function to get teams user details with access token
 * @param {*} authToken - accessToken
 * @param {*} tenantData - org details
 */
async function getTeamsUserWithToken(authToken, tenantData) {
    var profileReturned = {
        orgId: null,
        commId: null,
        name: null,
        userPermissions: []
    };
    let data;
    const profiledata = await getUserDetailsUsingToken(authToken);
    
    if(profiledata && profiledata.body){
        data = JSON.parse(profiledata.body);
        console.log("Profile data returned from get User Details-",data);
    }
    if (data && tenantData) {
        let cid = data.id;
        let username = data.displayName;
        let userRole;
        let orgDetails = JSON.parse(tenantData.body);
        let orgId = orgDetails["value"][0].id;
        let users = await dbUtils.getUserDetailsByAadId(orgId, cid);
        if (users && users.length > 0) {
            profileReturned.orgId = orgId;
            profileReturned.commId = users[0]?.commId;
            profileReturned.name = username;
            if (users[0].userRole) { 
                userRole = users[0].userRole;
            }
            else {
                let updateParams = { userRole: ADMIN_ROLE };
                userRole = ADMIN_ROLE;
                await updateUserToDB(orgId, users[0].userId, updateParams);
                console.log("Updating the user table with default role as Employee");
            }
        }
        else {
            console.log("User data received is null or undefined");
        }

        let userPermissions = await fetchUserPermissions(orgId, userRole);
        profileReturned.userPermissions = userPermissions;
        console.log("Profile data : " + JSON.stringify(profileReturned));
    }
    return profileReturned;
}


/**
 * Function to get authenticated data using temporary code
 * @param {*} code 
 * @param {*} redirectURI 
 * @param {*} clientTeamsId 
 */
const getAuthenticatedDataFromCode = async function (code, redirectURI, clientTeamsId) {    
    const teamsAppClientSecret = await RetrieveSecretAttribute(SecretKeys.TEAMS_APP_CLIENT_SECRET, SecretKeys.TEAMS_APP_CLIENT_SECRET + "-" + process.env.ENV);
    const data = {
        'grant_type': 'authorization_code',
        'scope': 'User.Read.All offline_access',
        'redirect_uri': redirectURI,
        'code': code
    };
    const options = {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        auth: {
            username: clientTeamsId,
            password: teamsAppClientSecret,
        },
        data: qs.stringify(data),
        url: ACCESS_TOKEN_URI,
    };
    try {
        let authResp = await axios.request(options);
        if (authResp && authResp.data) {
            return authResp.data;
        }
        else {
            console.error("Auth response using code does not contain data");
            return undefined;
        }
    }
    catch (error) {
        console.error(error);
        return undefined;
    }
};

/**
 * Function to get microsoft tenant details
 * @param {*} authToken 
 * @returns
 */
const getOrgDetails = async function(authToken) {
    const options = {
        host: 'graph.microsoft.com',
        path: '/beta/organization',
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + authToken
        }
    };

    let orgDetails = await doAPICall(options);
    return orgDetails;
};

/**
 * Function to get microsoft user details using token
 * @param {*} authToken 
 * @returns
 */
const getUserDetailsUsingToken = async function(authToken) {
  const options = {
    host: 'graph.microsoft.com',
    path: '/v1.0/me',
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + authToken
    }
  };

  let userDetails = await doAPICall(options);
  return userDetails;
};

module.exports = {
    setUserOrgDetails,
    fetchUserProfile
};
