/* Amplify Params - DO NOT EDIT
	ENV
	REGION
	STORAGE_ORGROLEPERMISSIONS_ARN
	STORAGE_ORGROLEPERMISSIONS_NAME
	STORAGE_ORGROLEPERMISSIONS_STREAMARN
	STORAGE_ORGUSER_ARN
	STORAGE_ORGUSER_NAME
	STORAGE_ORGUSER_STREAMARN
	STORAGE_ORG_ARN
	STORAGE_ORG_NAME
	STORAGE_ORG_STREAMARN
Amplify Params - DO NOT EDIT *//* Amplify Params - DO NOT EDIT
	ENV
	REGION
	STORAGE_ORGUSER_ARN
	STORAGE_ORGUSER_NAME
	STORAGE_ORGUSER_STREAMARN
	STORAGE_ORG_ARN
	STORAGE_ORG_NAME
	STORAGE_ORG_STREAMARN
Amplify Params - DO NOT EDIT *//*
Copyright 2017 - 2017 Amazon.com, Inc. or its affiliates. All Rights Reserved.
Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with the License. A copy of the License is located at
    http://aws.amazon.com/apache2.0/
or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and limitations under the License.
*/



const AWS = require('aws-sdk')
AWS.config.update({ region: 'us-east-1'});
var awsServerlessExpressMiddleware = require('aws-serverless-express/middleware')
var bodyParser = require('body-parser')
var express = require('express')
var cognitoidentityserviceprovider = new AWS.CognitoIdentityServiceProvider();

const empService = require('@searchutils/employees');
const searchUtilService = require('@searchutils/services');
const services = require('./services');
const { searchService } = require('./userServices');
const {getOrgAttribute} = require('@dbutils/org');
const {fetchRolePermissions} = require('@dbutils/rolePermissions');
const { fetchUserFromDB, updateUserToDB, insertUserToDB } = require('@dbutils/user');
const { TableNames } = require('@commonutils/constants');
const { pickObjectProperty } = require("@commonutils/pick");

const dynamodb = new AWS.DynamoDB.DocumentClient();
const  ADMIN_ROLE  = "Group Admin";
const path = "/user";

const userIdPresent = false; // TODO: update in case is required to use that definition
const partitionKeyName = "orgId";
const partitionKeyType = "S";
const sortKeyName = "userId";
const sortKeyType = "S";
const hasSortKey = sortKeyName !== "";
const UNAUTH = 'UNAUTH';
const hashKeyPath = '/:' + partitionKeyName;
const sortKeyPath = hasSortKey ? '/:' + sortKeyName : '';
const attributeKeyword = '/employeeKeyword'
const botUserPath = "/teamsUser";
// declare a new express app

console.log("Hi")
var app = express()
app.use(bodyParser.json())
app.use(awsServerlessExpressMiddleware.eventContext())



// // Enable CORS for all methods
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*")
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept")
  next()
});

// convert url string param to expected Type
const convertUrlType = (param, type) => {
  switch(type) {
    case "N":
      return Number.parseInt(param);
    default:
      return param;
  }
}

/********************************
 * HTTP Get method for list objects *
 ********************************/

app.get(path + hashKeyPath, function(req, res) {
  var condition = {}
  condition[partitionKeyName] = {
    ComparisonOperator: 'EQ'
  }

  if (userIdPresent && req.apiGateway) {
    condition[partitionKeyName]['AttributeValueList'] = [req.apiGateway.event.requestContext.identity.cognitoIdentityId || UNAUTH ];
  } else {
    try {
      condition[partitionKeyName]['AttributeValueList'] = [ convertUrlType(req.params[partitionKeyName], partitionKeyType) ];
    } catch(err) {
      res.statusCode = 500;
      res.json({error: 'Wrong column type ' + err});
    }
  }

  let queryParams = {
    TableName: TableNames.USER,
    KeyConditions: condition
  }

  dynamodb.query(queryParams, (err, data) => {
    if (err) {
      res.statusCode = 500;
      res.json({error: 'Could not load items: ' + err});
    } else {
      res.json(data.Items);
    }
  });
});

/*****************************************
 * HTTP Get method for get single object *
 *****************************************/

app.get(path + '/object' + hashKeyPath + sortKeyPath, function(req, res) {
  var params = {};
  if (userIdPresent && req.apiGateway) {
    params[partitionKeyName] = req.apiGateway.event.requestContext.identity.cognitoIdentityId || UNAUTH;
  } else {
    params[partitionKeyName] = req.params[partitionKeyName];
    try {
      params[partitionKeyName] = convertUrlType(req.params[partitionKeyName], partitionKeyType);
    } catch(err) {
      res.statusCode = 500;
      res.json({error: 'Wrong column type ' + err});
    }
  }
  if (hasSortKey) {
    try {
      params[sortKeyName] = convertUrlType(req.params[sortKeyName], sortKeyType);
    } catch(err) {
      res.statusCode = 500;
      res.json({error: 'Wrong column type ' + err});
    }
  }

  let getItemParams = {
    TableName: TableNames.USER,
    Key: params
  }

  dynamodb.get(getItemParams,(err, data) => {
    if(err) {
      res.statusCode = 500;
      res.json({error: 'Could not load items: ' + err.message});
    } else {
      if (data.Item) {
        res.json(data.Item);
      } else {
        res.json(data) ;
      }
    }
  });
});


/************************************
* HTTP put method for insert object *
*************************************/

app.put(path, function(req, res) {

  if (userIdPresent) {
    req.body['userId'] = req.apiGateway.event.requestContext.identity.cognitoIdentityId || UNAUTH;
  }

  let putItemParams = {
    TableName: TableNames.USER,
    Item: req.body
  }
  dynamodb.put(putItemParams, (err, data) => {
    if(err) {
      res.statusCode = 500;
      res.json({error: err, url: req.url, body: req.body});
    } else{
      res.json({success: 'put call succeed!', url: req.url, data: data})
    }
  });
});

/************************************
* HTTP post method for insert/update object *
*************************************/

app.post(path, async function(req, res) {
  console.log("post method for insert/update object , req.body - ", JSON.stringify(req.body));
  var response;
  if (userIdPresent) {
    req.body['userId'] = req.apiGateway.event.requestContext.identity.cognitoIdentityId || UNAUTH;
  }
  if(!req.body.createdDate){ //Checking if exist or not    
    console.log("inserting new user");
    response = await insertUserToDB(req.body.orgId, req.body);  
  }else{
    console.log("updating user");
    response = await updateUserToDB(req.body.orgId,req.body.userId,req.body);    
  }
  if(response == req.body.userEmail || response == req.body.userId) {//response will be userEmail for insert and userId for update 
    res.statusCode = 200;
    res.json({success: 'post call succeed!', url: req.url, data: response});    
  } else{
    res.json({error: 'post call failed!', url: req.url, body: req.body});
  }
});

/**************************************
* HTTP remove method to delete object *
***************************************/

app.delete(path + '/object' + hashKeyPath + sortKeyPath, function(req, res) {
  console.log("remove method to delete object, req.body - ", JSON.stringify(req.body));
  var params = {};
  if (userIdPresent && req.apiGateway) {
    params[partitionKeyName] = req.apiGateway.event.requestContext.identity.cognitoIdentityId || UNAUTH;
  } else {
    params[partitionKeyName] = req.params[partitionKeyName];
     try {
      params[partitionKeyName] = convertUrlType(req.params[partitionKeyName], partitionKeyType);
    } catch(err) {
      res.statusCode = 500;
      res.json({error: 'Wrong column type ' + err});
    }
  }
  if (hasSortKey) {
    try {
      params[sortKeyName] = convertUrlType(req.params[sortKeyName], sortKeyType);
    } catch(err) {
      res.statusCode = 500;
      res.json({error: 'Wrong column type ' + err});
    }
  }

  let removeItemParams = {
    TableName: TableNames.USER,
    Key: params
  }
  dynamodb.delete(removeItemParams, (err, data)=> {
    if(err) {
      res.statusCode = 500;
      res.json({error: err, url: req.url});
    } else {
      res.json({url: req.url, data: data});
    }
  });
});

/******************************************************
* HTTP post method to get distinct values of an attribute*
******************************************************/

app.post(attributeKeyword + hashKeyPath, async function(req, res) {
  let orgId = "";
  if (userIdPresent && req.apiGateway) {
    orgId = req.apiGateway.event.requestContext.identity.cognitoIdentityId || UNAUTH;
  } else {
    try {
      orgId = convertUrlType(req.params[partitionKeyName], partitionKeyType);
    } catch (err) {
      res.statusCode = 500;
      res.json({ error: 'Wrong column type ' + err });
    }
  }
  let queryAttribute = req.body.attribute;
  let response = await empService.getDistinctEmpAttributeValues(orgId, queryAttribute)
  console.log('data', response)
  if(response){
   res.json(JSON.stringify(response))
 }
 else{
   res.json('failed');
 }
  
});

/******************************************************
* HTTP put method to update filter values of an employee(single)*
******************************************************/
app.put(path + hashKeyPath , async function(req, res) {
  console.log("update employee filter----", JSON.stringify(req.body))
  let orgId = req.body.orgId;
  let commId=req.body.commId;
  const userId = await empService.getUserIdFromCommId(orgId, commId);
  if (userId) {
    let putItemParams = {
      TableName: TableNames.USER,
      Key: {
        "orgId": req.body.orgId,
        "userId": userId,
      },
      UpdateExpression: "SET  filterList =:filterList",
      ExpressionAttributeValues: {
        ":filterList": req.body.filterList
      }
    };
    dynamodb.update(putItemParams, (err, data) => {
      if (err) {
        console.log(err);
        res.statusCode = 500;
        res.json({ error: err, url: req.url, body: req.body });
      } else {
        res.json({ success: 'put call succeed!', url: req.url, data: data })
      }
    });
  }
  else {
    res.json({ success: 'put call succeed!, user does not exist', url: req.url })
  }
});

//Http post method to get single user data using commId//

app.post(path + '/object' + hashKeyPath ,async function(req, res) {
  let orgId = req.body.orgId;
  let commId= req.body.commId;
  let searchCond = [
    { match: { "commId": commId } }
  ];
  const userData = await empService.getFilteredEmployees(orgId, searchCond);
  
  if(userData){
    res.json(userData)
  }
  else{
    res.json('unable to retrive employee data')
  }
});

/**
 * Handler function to register a user.
 * endpoint: /user/register
 */
app.post(path + '/register', async function (req, res) {
  const userName = req.body.userName;
  const userEmail = req.body.userEmail;
  const userPassword = req.body.userPassword;
  const clientId = req.body.clientId;
  let response = await services.registerUser(clientId, userName, userEmail, userPassword, cognitoidentityserviceprovider);
  if (response) {
    res.json({ err: true , msg:response.msg});
  }
  else {
    res.json({ err: false })
  }
});

/**
 * Handler function to fetch user profile.
 * endpoint: /user/profile
 */

app.post(path + '/profile', async function (req, res) {
  console.log("Inside the Profile API")
  const searchOptions = pickObjectProperty(req.body, [ "offset", "limit", "sortBy", "sortOrder", "filters" ]);
  let result = await searchService.getSearchResults(searchOptions);
  if (result) {
    console.log("resut data:",result)
    let userData = result.data[0];
    console.log("UserData is here:",userData)
    let userProfile = {
      orgId: userData.orgId,
      name: userData?.firstName + " " + userData.lastName??"",
      userPermissions: []
    } 
    console.log("User profile is here:",userProfile)
    let permission = await fetchRolePermissions(userData.orgId, userData.userRole);
    console.log("Permission response:",permission)
    userProfile.userPermissions = permission.userPermissions;
    res.json({ err: false, data: userProfile });
  }
  else {
    res.json({ err: true })
  }
});

/**********************************************************REQUEST HANDLER*************************************************************/
/**
 * Handler function to check if the filtered users count is above the ORG's audienceLimit.
 * endpoint: /user/:orgId/search
 */
 app.post(path + '/:orgId/search', async (req, res) => {
  const { orgId } = req.params;
  let audienceThreshold;
  let limitCheck = { limitExceeded : true };
  const getParams = 'audienceLimit';
  audienceThreshold = await getOrgAttribute(orgId, getParams);
  
  if(audienceThreshold && audienceThreshold.Item && audienceThreshold.Item.audienceLimit){
    audienceThreshold = audienceThreshold.Item.audienceLimit;
  }else{
    audienceThreshold = undefined;
  }

  if(audienceThreshold){
    var elasticSearchConditions;
    if(req.body ){
      if (req.body.searchCond){
        elasticSearchConditions =  req.body.searchCond[0];
      }
    }  
    console.log("search conditions for elastic query-",JSON.stringify(elasticSearchConditions));
    const updatedFilterQuery = await searchUtilService.setElasticFilterQuery(elasticSearchConditions);
    let empCount = await empService.getFilteredEmployeesCount(orgId, updatedFilterQuery);
    console.log("audience limit for org-",audienceThreshold);
    if(empCount && empCount < audienceThreshold){
      limitCheck.limitExceeded =  false;
    }
  }

  res.json(limitCheck);

});


/**********************************************************REQUEST HANDLER*************************************************************/
/**
 * Handler function to check if the filtered audience count is above the ORG's audienceLimit before launching a campaign
 * endpoint: /user/:orgId/checkAudienceThreshold
 */
 app.post(path + '/:orgId/checkAudienceThreshold', async (req, res) => {
  //  console.log("INside checkAudienceThreshold");
  const { orgId } = req.params;
  var elasticSearchConditions;
  if(req.body ){
    if (req.body.searchCond){
      elasticSearchConditions =  req.body.searchCond;
    }
  }  
  // console.log("search conditions for elastic query: ",JSON.stringify(elasticSearchConditions,null,3));

  let result = await services.checkAudienceThresholdForCampaign(orgId,elasticSearchConditions);
  let limitCheck = {
     aboveThreshold : result
  };
  res.json(limitCheck);
});


/**********************************************************REQUEST HANDLER*************************************************************/
/**
 * Handler function to fetch and save users for a selected slack channel
 * endpoint: /user/:orgId/saveUsersForChannel
 */
 app.post(path + '/:orgId/saveUsersForChannel', async (req, res) => {
  //  console.log("INside saveUsersForChannel");
  const { orgId } = req.params;
  var channelObj;
  if(req.body ){
      channelObj =  req.body.channelObj;
  }  
  console.log("search conditions for elastic query: ",JSON.stringify(channelObj,null,3));
  let result = await services.saveUsersForChannel(orgId,channelObj);
  res.json(result);
});


/**********************************************************REQUEST HANDLER*************************************************************/
/**
 * Handler function to fetch users with only the specified list of attributes
 * endpoint: /user/:orgId/getUsersWithSpecificAttributes
 */
 app.post(path + '/:orgId/getUsersWithSpecificAttributes', async (req, res) => {
  //  console.log("Inside getUsersWithSpecificAttributes");
  const { orgId } = req.params;
  var attributes;
  if(req.body ){
    attributes =  req.body.attributes;
  }  
  console.log("search conditions for elastic query: ",JSON.stringify(attributes,null,3));
  let result = await services.getUsersWithSpecificAttributes(orgId,attributes);
  res.json(result);
});

/**********************************************************REQUEST HANDLER*************************************************************/
/**
 * Handler function to get all slack channels for an ORG
 * endpoint: /user/:orgId/fetchSlackChannels/:commId
 */
 app.get(path + '/:orgId/fetchSlackChannels/:commId', async (req, res) => {

  // Retrieve path params.
  const { orgId,commId } = req.params;
  console.log("Inside fetchSlackChannels api endpoint ",orgId,commId);
  const response = await services.fetchSlackChannelsForUser(orgId,commId);

  res.statusCode = response.statusCode;
  res.json(response);

});



/***********************************************************************
* HTTP post method for inserting teams user on adding Berry to Teams *
************************************************************************/
app.post(botUserPath, async function(req, res) {
  let userData;
  req.body.userRole = ADMIN_ROLE;
  console.log("Incoming user updation/insertion for Teams user-", JSON.stringify(req.body));
  if(req.body && req.body.orgId && req.body.userId){
    userData = await fetchUserFromDB(req.body.orgId, req.body.userId);
  }
  if(userData){
    let updateParams = {  commId : req.body.commId,
                          serviceUrl : req.body.serviceUrl    };
    await updateUserToDB(req.body.orgId,req.body.userId,updateParams);
  }
  else{
    await insertUserToDB(req.body.orgId, req.body);
  }
});

/**********************************************************REQUEST HANDLER*************************************************************/
/**
 * Handler function to get all unique values for list of fields configured in DB at org level
 * endpoint: /user/:orgId/fetchUniqueValues
 */
 app.get(path + '/:orgId/fetchUniqueValues', async (req, res) => {

  // console.log("chkpt1 - start");
  // Retrieve path params.
  const { orgId } = req.params;

  const response = await services.fetchUniqueValues(orgId);

  res.statusCode = response.statusCode;
  res.json(response);

});


/**********************************************************REQUEST HANDLER*************************************************************/
/**
 * Handler function to get all unique values for list of fields configured in DB at org level
 * endpoint: /user/:orgId/fetchUniqueValues
 */
 app.get(path + '/:orgId/fetchCoverage', async (req, res) => {
  console.log("chkpt1 - start");
  const { orgId } = req.params;
  const response = await services.fetchCoverage(orgId);
  res.statusCode = response.statusCode;
  res.json(response);
});


app.listen(3000, function() {
    console.log("App started")
});

// Export the app object. When executing the application local this does nothing. However,
// to port it to AWS Lambda we will create a wrapper around that will load the app from
// this file
module.exports = app
