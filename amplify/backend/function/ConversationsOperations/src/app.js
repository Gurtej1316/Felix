/* Amplify Params - DO NOT EDIT
	ENV
	REGION
	STORAGE_CONVERSATIONS_ARN
	STORAGE_CONVERSATIONS_NAME
	STORAGE_CONVERSATIONS_STREAMARN
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


const services = require('./services');
const AWS = require('aws-sdk')
var awsServerlessExpressMiddleware = require('aws-serverless-express/middleware')
var bodyParser = require('body-parser')
var express = require('express')

AWS.config.update({ region: process.env.TABLE_REGION });

const dynamodb = new AWS.DynamoDB.DocumentClient();
const convService = require('@searchutils/conversations');
let tableName = "Conversations";
if (process.env.ENV && process.env.ENV !== "NONE") {
  tableName = tableName + '-' + process.env.ENV;
}
const pathFilterConv = "/filteredconversations";
const pathFilterResp = "/filteredResponses";
const userIdPresent = false; // TODO: update in case is required to use that definition
const partitionKeyName = "PK";
const partitionKeyType = "S";
const sortKeyName = "SK";
const sortKeyType = "S";
const hasSortKey = sortKeyName !== "";
const path = "/orgconversations";
const pathResp = "/convresponses";
//const pathConv = "/allconversations";
const UNAUTH = 'UNAUTH';
const hashKeyPath = '/:' + partitionKeyName;
const sortKeyPath = hasSortKey ? '/:' + sortKeyName : '';
// declare a new express app
var app = express()
app.use(bodyParser.json())
app.use(awsServerlessExpressMiddleware.eventContext())

// Enable CORS for all methods
app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*")
  res.header("Access-Control-Allow-Headers", "*")
  next()
});

// convert url string param to expected Type
const convertUrlType = (param, type) => {
  switch (type) {
    case "N":
      return Number.parseInt(param);
    default:
      return param;
  }
}

/**********************************************************REQUEST HANDLER*************************************************************/
/**
 * Handler function to get all global filters based on org.
 * endpoint: /orgconversations/:orgId/filters
 */
 app.post(path + '/:orgId/filters', async (req, res) => {

  // Retrieve path params.
  let filterApplied;
  if(req.body && req.body.filter){
    filterApplied = req.body.filter;
  }
  const { orgId } = req.params;

  const response = await services.fetchConversationFilters(orgId, filterApplied);

  res.statusCode = response.statusCode;
  res.json(response);

});

/**********************************************************REQUEST HANDLER*************************************************************/
/**
 * Handler function to get all global filters based on org.
 * endpoint: /orgconversations/:orgId/search
 */
 app.post(path + '/:orgId/search', async (req, res) => {

  // Retrieve path params.
  const { orgId } = req.params;

  const size = req.querySize;
  const response = await services.fetchFilteredConversations(orgId, req.body, size);
  res.statusCode = response.statusCode;
  res.json(response);

});

/********************************
 * HTTP Get method with Filters (Elastic Search)for list objects *
 ********************************/

app.get(pathFilterConv + hashKeyPath, function (req, res) {
  console.log(" In ES Conv - " + pathFilterConv + " - " + hashKeyPath);
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
  console.log(" In ES orgId - " + orgId);

  var searchCond = [];
  if (req.apiGateway.event["queryStringParameters"]) {
    var filters = req.apiGateway.event["queryStringParameters"];
    console.log(filters);
    for (let [key, value] of Object.entries(filters)) {
      //console.log(key, value);
      let filterObj={};
      filterObj[key]=value;
      let searchterm = {
        match: filterObj
      }
      //console.log(searchterm);
      searchCond.push(searchterm);
  }
    

    console.log(searchCond);
  }
  let querySize = 10000;
  convService.getFilteredConversations(orgId, searchCond, querySize)
    .then(result => {
      console.log("conv ", result);
      res.statusCode = 200;
      res.json(result);
    })
    .catch(err => console.error(`Error doing the request for the event: ${err}`));

});


/**********************************************************REQUEST HANDLER*************************************************************/
/**
 * Handler function to get responses data aggregated for list of moments passed.
 * endpoint: /filteredResponses/:orgId/search
 */
 app.post(pathFilterResp + '/:orgId/search', async (req, res) => {

  // Retrieve path params.
  const { orgId } = req.params;
  console.log("Path Attributes: ",orgId,req.body);


  const response = await services.getSentimentDataForMoments(orgId, req.body);
  // console.log("app.js - response: ",JSON.stringify(response,null,3));
  res.statusCode = response.statusCode;
  res.json(response);

});



/********************************
 * HTTP Get method with Filters (Elastic Search)for list objects *
 ********************************/

app.get(pathFilterResp + hashKeyPath, function (req, res) {
  console.log(" In ES Resp - " + pathFilterConv + " - " + hashKeyPath);
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
  console.log(" In ES orgId - " + orgId);

  var searchCond = [];
  if (req.apiGateway.event["queryStringParameters"]) {
    var filters = req.apiGateway.event["queryStringParameters"];
    console.log(filters);
    for (let [key, value] of Object.entries(filters)) {
      // console.log(key, value);
      let filterObj={};
      filterObj[key]=value;
      let searchterm = {
        match: filterObj
      };
      searchCond.push(searchterm);
    }
    console.log(searchCond);
  }
  // console.log("Search Cond",searchCond);
  convService.getFilteredResponses(orgId, searchCond)
    .then(result => {
      console.log("conv ", result);
      res.statusCode = 200;
      res.json(result);
    })
    .catch(err => console.error(`Error doing the request for the event: ${err}`));
   }
 
);

/********************************
 * HTTP Get method for list objects *
 ********************************/

app.get(path + hashKeyPath, function (req, res) {
  var condition = {}
  condition[partitionKeyName] = {
    ComparisonOperator: 'EQ'
  }

  if (userIdPresent && req.apiGateway) {
    condition[partitionKeyName]['AttributeValueList'] = [req.apiGateway.event.requestContext.identity.cognitoIdentityId || UNAUTH];
  } else {
    try {
      condition[partitionKeyName]['AttributeValueList'] = [convertUrlType(req.params[partitionKeyName], partitionKeyType)];
    } catch (err) {
      res.statusCode = 500;
      res.json({ error: 'Wrong column type ' + err });
    }
  }
  var beginWithVal;
  var filterName;
  var filterValue;
  var filterEx;
  if (req.apiGateway.event["queryStringParameters"]) {
    filterName = req.apiGateway.event["queryStringParameters"].filterName;
    filterValue = req.apiGateway.event["queryStringParameters"].filterValue;
    if (filterName && filterValue) {
      filterEx = '#' + filterName + ' = :filVal';
    }
    beginWithVal = req.apiGateway.event["queryStringParameters"].skBeginsWith;
    if (beginWithVal) {
      condition[sortKeyName] = {
        ComparisonOperator: 'BEGINS_WITH'
      }
      condition[sortKeyName]['AttributeValueList'] = [beginWithVal];
    }
  }

  let queryParams = {
    TableName: tableName,
    KeyConditions: condition
  }

  if (filterEx) {
    queryParams.ExpressionAttributeNames = {};
    queryParams.ExpressionAttributeNames["#" + filterName] = filterName;
    queryParams.FilterExpression = filterEx;
    queryParams.ExpressionAttributeValues = {};
    queryParams.ExpressionAttributeValues[':filVal'] = filterValue;
  }
  console.log(" queryParams  - " + JSON.stringify(queryParams));

  dynamodb.query(queryParams, (err, data) => {
    if (err) {
      res.statusCode = 500;
      res.json({ error: 'Could not load items: ' + err });
    } else {
      res.json(data.Items);
    }
  });
});

/*****************************************
 * HTTP Get method for get single object *
 *****************************************/

app.get(path + '/object' + hashKeyPath + sortKeyPath, function (req, res) {
  var params = {};
  if (userIdPresent && req.apiGateway) {
    params[partitionKeyName] = req.apiGateway.event.requestContext.identity.cognitoIdentityId || UNAUTH;
  } else {
    params[partitionKeyName] = req.params[partitionKeyName];
    try {
      params[partitionKeyName] = convertUrlType(req.params[partitionKeyName], partitionKeyType);
    } catch (err) {
      res.statusCode = 500;
      res.json({ error: 'Wrong column type ' + err });
    }
  }
  if (hasSortKey) {
    try {
      params[sortKeyName] = convertUrlType(req.params[sortKeyName], sortKeyType);
    } catch (err) {
      res.statusCode = 500;
      res.json({ error: 'Wrong column type ' + err });
    }
  }

  let getItemParams = {
    TableName: tableName,
    Key: params
  }

  dynamodb.get(getItemParams, (err, data) => {
    if (err) {
      res.statusCode = 500;
      res.json({ error: 'Could not load items: ' + err.message });
    } else {
      if (data.Item) {
        res.json(data.Item);
      } else {
        res.json(data);
      }
    }
  });
});


/************************************
* HTTP put method for insert object *
*************************************/

app.put(path, function (req, res) {

  if (userIdPresent) {
    req.body['userId'] = req.apiGateway.event.requestContext.identity.cognitoIdentityId || UNAUTH;
  }

  let putItemParams = {
    TableName: tableName,
    Item: req.body
  }
  dynamodb.put(putItemParams, (err, data) => {
    if (err) {
      res.statusCode = 500;
      res.json({ error: err, url: req.url, body: req.body });
    } else {
      res.json({ success: 'put call succeed!', url: req.url, data: data })
    }
  });
});

/************************************
* HTTP post method for insert object *
*************************************/

app.post(path, function (req, res) {

  if (userIdPresent) {
    req.body['userId'] = req.apiGateway.event.requestContext.identity.cognitoIdentityId || UNAUTH;
  }

  let putItemParams = {
    TableName: tableName,
    Item: req.body
  }
  dynamodb.put(putItemParams, (err, data) => {
    if (err) {
      res.statusCode = 500;
      res.json({ error: err, url: req.url, body: req.body });
    } else {
      res.json({ success: 'post call succeed!', url: req.url, data: data })
    }
  });
});

/**************************************
* HTTP remove method to delete object *
***************************************/

app.delete(path + '/object' + hashKeyPath + sortKeyPath, function (req, res) {
  var params = {};
  if (userIdPresent && req.apiGateway) {
    params[partitionKeyName] = req.apiGateway.event.requestContext.identity.cognitoIdentityId || UNAUTH;
  } else {
    params[partitionKeyName] = req.params[partitionKeyName];
    try {
      params[partitionKeyName] = convertUrlType(req.params[partitionKeyName], partitionKeyType);
    } catch (err) {
      res.statusCode = 500;
      res.json({ error: 'Wrong column type ' + err });
    }
  }
  if (hasSortKey) {
    try {
      params[sortKeyName] = convertUrlType(req.params[sortKeyName], sortKeyType);
    } catch (err) {
      res.statusCode = 500;
      res.json({ error: 'Wrong column type ' + err });
    }
  }

  let removeItemParams = {
    TableName: tableName,
    Key: params
  }
  dynamodb.delete(removeItemParams, (err, data) => {
    if (err) {
      res.statusCode = 500;
      res.json({ error: err, url: req.url });
    } else {
      res.json({ url: req.url, data: data });
    }
  });
});

/********************************
 * HTTP Get method for list objects *
 ********************************/

app.get(pathResp + hashKeyPath, function (req, res) {
  console.log("HTTP Get method for list object : all responses ");
  console.log("hashKeyPath " + hashKeyPath);
  var condition = {}
  condition[partitionKeyName] = {
    ComparisonOperator: 'EQ'
  }

  if (userIdPresent && req.apiGateway) {
    condition[partitionKeyName]['AttributeValueList'] = [req.apiGateway.event.requestContext.identity.cognitoIdentityId || UNAUTH];
  } else {
    try {
      condition[partitionKeyName]['AttributeValueList'] = [convertUrlType(req.params[partitionKeyName], partitionKeyType)];
    } catch (err) {
      res.statusCode = 500;
      res.json({ error: 'Wrong column type ' + err });
    }
  }
  condition[sortKeyName] = {
    ComparisonOperator: 'BEGINS_WITH'
  }
  condition[sortKeyName]['AttributeValueList'] = ['RESP'];
  var filterName;
  var filterValue;
  var filterEx;
  var beginWithVal;
  if (req.apiGateway.event["queryStringParameters"]) {

    filterName = req.apiGateway.event["queryStringParameters"].filterName;
    filterValue = req.apiGateway.event["queryStringParameters"].filterValue;
    if (filterName && filterValue) {
      filterEx = '#' + filterName + ' = :filVal';
    }
    beginWithVal = req.apiGateway.event["queryStringParameters"].skBeginsWith;
    if (beginWithVal) {
      condition[sortKeyName]['AttributeValueList'] = [beginWithVal];
    }
  }

  let queryParams = {
    TableName: tableName,
    KeyConditions: condition
  }

  if (filterEx) {
    queryParams.ExpressionAttributeNames = {};
    queryParams.ExpressionAttributeNames["#" + filterName] = filterName;
    queryParams.FilterExpression = filterEx;
    queryParams.ExpressionAttributeValues = {};
    queryParams.ExpressionAttributeValues[':filVal'] = filterValue;
  }

  console.log(" queryParams  " + JSON.stringify(queryParams));
  dynamodb.query(queryParams, (err, data) => {
    if (err) {
      res.statusCode = 500;
      res.json({ error: 'Could not load items: ' + err });
    } else {
      res.json(data.Items);
    }
  });
});

app.listen(3000, function () {
  console.log("App started")
});

// Export the app object. When executing the application local this does nothing. However,
// to port it to AWS Lambda we will create a wrapper around that will load the app from
// this file
module.exports = app
