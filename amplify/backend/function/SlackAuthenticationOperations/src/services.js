const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

const { SLACK_HOST_NAME, SLACK_OAUTHV2_ACCESS_PATH, 
  TEAMID_TOKEN_ATTR, USERID_TOKEN_ATTR,
  ADMIN_ROLE, EMPLOYEE_ROLE, SLACK_COMMCHANNEL,
  SLACK_OAUTH_OPENID_PATH } = require('./config');

const { ResponseFormatter, ERRORS } = require('@commonutils/formatter');
const { getOrgAttribute, updateOrg } = require('@dbutils/org');
const { fetchUserFromDB } = require('@dbutils/user');
const { TableNames } = require('@commonutils/constants');
const { updateUserToDB, insertUserToDB } = require('@dbutils/user');
const { Freemium_Roles, Org_Defaults, Default_Questions, Default_Templates } = require('@commonutils/freemiumConstants');
const { getBotCallbackId } = require('@communicationutils/slackServices');
const { SecretKeys, RetrieveSecretAttribute } = require('@commonutils/secretManager');
const { doAPICall, createOrgIdentifierFromOrgName, insertDefaultData} = require('@commonutils/services');
const { getExecutedWorkflowListFromSearch } = require('@searchutils/workflow');
const { WorkflowStatus } = require('@commonutils/constants');

/**
 * Function to update org detail
 * @param {*} code 
 * @param {*} redirectURI 
 * @param {*} clientSlackID 
 */
const updateOrgDetails = async function (code, redirectURI, clientSlackID) {
  console.log("inside updateorgdetails-", code, redirectURI, clientSlackID);
  const options = await setUrlOptions(code, redirectURI, clientSlackID, SLACK_OAUTHV2_ACCESS_PATH);
  try {
    const data = await doAPICall(options);
    const authenticatedData = JSON.parse(data.body);
    console.log("authenticated data-", authenticatedData);

    if(authenticatedData && authenticatedData.ok && authenticatedData.ok === true 
      && authenticatedData.access_token && authenticatedData.authed_user &&authenticatedData.authed_user.access_token) {
        
      const slackBotToken = authenticatedData.access_token;
      const orgId = authenticatedData.team.id;

      let resp = await getOrgAttribute(orgId, 'orgId,slackToken,commChannel,orgIdentifier');
      let org;
      if (resp && resp.Item) {
        //CASE - when the ORG exists already - only update bot token
        let updateParams = { slackToken: slackBotToken };
        await updateOrg(orgId, updateParams);
      }
      else {
        //CASE - when it is a new ORG to be made
        org = Org_Defaults;
        let orgName = authenticatedData.team.name;
        if(orgName){
          let orgIdentifier = await createOrgIdentifierFromOrgName( orgName );
          org.orgName = orgName;
          org.orgIdentifier = orgIdentifier;
        }
        org.orgId = orgId;
        org.slackToken = slackBotToken;
        org.commChannel = SLACK_COMMCHANNEL;
        org.commChannelList.push(SLACK_COMMCHANNEL);
        org.createdDate = new Date().toISOString();
        const callbackId = await getBotCallbackId(slackBotToken);
        console.log("callbackID returned in updateOrgDetails",callbackId);
        if (callbackId) {
          org.callbackId = callbackId;
        }
        console.log("Org details in setUserOrgDetails ", org );
        await insertOrgData(org);
        await insertDefaultData(orgId, TableNames.ROLEPERMISSIONS, Freemium_Roles);
        await insertDefaultData(orgId, TableNames.STEP, Default_Questions);
        await insertDefaultData(orgId, TableNames.WORKFLOW, Default_Templates);
        //todo - add predefined questions and templates and anything else here for a new org
      }
      let userBotToken = authenticatedData.authed_user.access_token;
      await setUserDataFromBotTokenOnInstall(orgId, authenticatedData.authed_user.id, slackBotToken, userBotToken);
      return({commChannel: "Slack" });
    }
    else {
      console.error("Could not pull slack token successfully during installation");
      return ResponseFormatter("Could not pull slack token successfully during installation", ERRORS.INTERNAL_ERROR);
    }

  } catch (error) {
    console.error(error);
    return ResponseFormatter(null, ERRORS.INTERNAL_ERROR);
  }

};


/**
 * Function to get user profile using slack token
 * @param {*} code 
 * @param {*} redirectURI 
 * @param {*} clientSlackID 
 */
const fetchUserProfile = async function (code, redirectURI, clientSlackID) {
  console.log("inside fetchUserProfile-", code, redirectURI, clientSlackID);
  let orgExists = false;
  let profileReturned;
  const options = await setUrlOptions(code, redirectURI, clientSlackID, SLACK_OAUTH_OPENID_PATH);
  try {
    const data = await doAPICall(options);
    console.log("This is data:",data)
    const authenticatedData = JSON.parse(data.body);
    console.log("THis is authenticatedData:",authenticatedData)
    if (authenticatedData != undefined && authenticatedData.ok && authenticatedData.ok === true
      && authenticatedData.access_token != undefined && authenticatedData.access_token != null
      && authenticatedData.id_token) {
      let campaignExists = false;
      let decodedJWT = await decodeIdToken(authenticatedData.id_token);
      const teamId = decodedJWT[TEAMID_TOKEN_ATTR];
      let org = await getOrgAttribute(teamId, 'slackToken,commChannel,orgIdentifier,orgPricingType');
      console.log("This is org returning before if condition:",org)

      if (org && org.Item) {
        orgExists = true;
        profileReturned = await setUserProfileUsingTokenOnLogin(decodedJWT);
        campaignExists = await checkCampaignExistanceForOrg(teamId);
        return ({ orgExists: orgExists, profileReturned: profileReturned, orgPricingType: org.Item.orgPricingType , campaignExists:campaignExists });
      }
      else {
        console.log("Org Id of user doesn not exist in DB!");
        return ResponseFormatter("Org Id of user doesn not exist in DB!", ERRORS.INTERNAL_ERROR);
      }
    }
    else {
      
      return ResponseFormatter("Could not pull slack token successfully during login", ERRORS.INTERNAL_ERROR);
    }

  } catch (error) {
    console.error(error);
    return ResponseFormatter(null, ERRORS.INTERNAL_ERROR);
  }

};

/**
 * Function to set url options for slack api call to get access token
 * @param {*} code 
 * @param {*} redirectURI 
 * @param {*} clientSlackID 
 * @param {*} outhAccessPath 
 * @returns
 */
async function setUrlOptions(code, redirectURI, clientSlackID, outhAccessPath) {
  var clientSlackSecret = await RetrieveSecretAttribute(SecretKeys.SLACK_APP_CLIENT_SECRET, SecretKeys.SLACK_APP_CLIENT_SECRET+ "-" + process.env.ENV);
  const options = {
    host: SLACK_HOST_NAME,
    path: outhAccessPath + clientSlackID + '&client_secret=' + clientSlackSecret + '&code='
      + code + '&redirect_uri=' + redirectURI,
    method: 'GET'
  };

  return options;
}

/**
 * Function to fetch user permissions based on user role
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
 * Function to insert org details to DB
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
 * Function to check if a campaign is already created for the org
 * @param {*} orgId 
 */
 async function checkCampaignExistanceForOrg(orgId) {
  let campaignFilters = [];
  let searchCond = [];
  campaignFilters.push({ term: { "status.keyword": { value: WorkflowStatus.RUNNING } } }  ); 
  campaignFilters.push({ term: { "status.keyword": { value: WorkflowStatus.LAUNCHED } } }  ); 
  campaignFilters.push({ term: { "status.keyword": { value: WorkflowStatus.COMPLETED } } }  ); 
  searchCond.push({ bool: { should: [...campaignFilters]}});
  let options = {searchCond : searchCond};
  const response = await getExecutedWorkflowListFromSearch(orgId, options);
  if(response && response.items &&response.items.length>0 ){
    return true;
  }
  else{
    return false;
  }
}

/**
 * Function to decode JSON Web token
 * @param {*} idToken 
 * @returns
 */
async function decodeIdToken(idToken) {
  var base64String = idToken.split('.')[1];
  var decodedValue = JSON.parse(Buffer.from(base64String, 'base64').toString('ascii'));
  return decodedValue;
}


/**
 * Function to return user profile during login
 * @param {*} idToken 
 * @returns
 */
async function setUserProfileUsingTokenOnLogin(idToken) {
  var profileReturned = {
    orgId: null,
    commId: null,
    name: null,
    userRole:null,
    userPermissions: []
  };

  let userRole;
  try{
  let orgId = idToken[TEAMID_TOKEN_ATTR];
  let commId = idToken[USERID_TOKEN_ATTR];

  profileReturned.orgId = orgId;
  profileReturned.commId = commId;
  profileReturned.name = idToken.name;

  let userData = await fetchUserFromDB(orgId, idToken.email);
  if (userData && userData.userId) {
    if (userData.userRole ) { 
      userRole = userData.userRole;
    }
    else {
      userRole = EMPLOYEE_ROLE;
      let updateParams = { userRole: EMPLOYEE_ROLE };
      await updateUserToDB(orgId, idToken.email, updateParams);
    }
  }
  else {
    userRole=EMPLOYEE_ROLE;
    let userData = {
      orgId: orgId,
      userId: idToken.email,
      userEmail: idToken.email,
      firstName: idToken.given_name || idToken.name,
      lastName: idToken.family_name,
      userRole: EMPLOYEE_ROLE,
      commId: commId,
      commChannel: SLACK_COMMCHANNEL
    };
    console.log("User Data getting inserted into DB -", userData);
    await insertUserToDB(orgId, userData);
  }

  let userPermissions = await fetchUserPermissions(orgId, userRole);
  profileReturned.userPermissions = userPermissions;
  profileReturned.userRole = userRole;
  console.log("Profile data : " + JSON.stringify(profileReturned));
  return profileReturned;
} catch (error) {
  console.error(error);
  return ResponseFormatter(null, ERRORS.INTERNAL_ERROR);
}
}

/**
 * Function to get user info using commId and botToken
 * @param {*} commId 
 * @param {*} botToken 
 * @returns
 */
const getUserProfile = async function (commId, botToken) {
  const options = {
    host: 'slack.com',
    path: '/api/users.info?user=' + commId + '&pretty=1',
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + botToken
    }
  };

  let returnData = await doAPICall(options);
  return returnData;
};

/**
 * Function to insert user data into DB during installation
 * @param {*} orgId 
 * @param {*} commId 
 * @param {*} botToken 
 * @param {*} userToken 
 */
async function setUserDataFromBotTokenOnInstall(orgId, commId, botToken, userToken) {
  console.log("inside fetchUserProfileFromBotTokenOnInstall()-", commId);
  
  let userProfile = await getUserProfile(commId, botToken);
  userProfile = JSON.parse(userProfile.body);

  if (userProfile && userProfile.user && userProfile.user.profile) {
    let userData = await fetchUserFromDB(orgId, userProfile.user.profile.email);
    if (userData && userData.userId) {
      //CASE - when user already exists
      //<TODO - think more?>
      if (!userData.userRole) {
        let updateParams = { userRole: ADMIN_ROLE };
        await updateUserToDB(orgId, userProfile.user.profile.email, updateParams);
      }
    }
    else {
      //CASE - when no such user exists

      let userData = {
        orgId: orgId,
        userId: userProfile.user.profile.email,
        userEmail: userProfile.user.profile.email,
        firstName: userProfile.user.profile.first_name || userProfile.user.name,
        lastName: userProfile.user.profile.last_name,
        userRole: ADMIN_ROLE, //todo - what about not freemium?
        commId: commId,
        slackUserToken: userToken,
        commChannel: SLACK_COMMCHANNEL //todo - handle this also somehow
      };
      console.log("User Data getting inserted into DB -", userData);
      await insertUserToDB(orgId, userData);
    }
  }
}

module.exports = {
  updateOrgDetails,
  fetchUserProfile
};
