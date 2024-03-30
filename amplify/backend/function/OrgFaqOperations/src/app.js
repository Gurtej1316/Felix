/* Amplify Params - DO NOT EDIT
	ENV
	REGION
	STORAGE_ORGFAQ_ARN
	STORAGE_ORGFAQ_NAME
	STORAGE_ORGFAQ_STREAMARN
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
const awsServerlessExpressMiddleware = require('aws-serverless-express/middleware')
const bodyParser = require('body-parser')
const express = require('express')
const services = require('./services');
const { searchService, aggregateService } = require('./faqServices');
const { pickObjectProperty } = require("@commonutils/pick");
const { TableNames } = require('@commonutils/constants');

AWS.config.update({ region: process.env.TABLE_REGION });
const dynamodb = new AWS.DynamoDB.DocumentClient();

const userIdPresent = false; // TODO: update in case is required to use that definition
const partitionKeyName = "orgId";
const partitionKeyType = "S";
const sortKeyName = "faqId";
const sortKeyType = "S";
const hasSortKey = sortKeyName !== "";
const path = "/faq";
const UNAUTH = 'UNAUTH';
const hashKeyPath = '/:' + partitionKeyName;
const sortKeyPath = hasSortKey ? '/:' + sortKeyName : '';

// declare a new express app
const app = express()
app.use(bodyParser.json())
app.use(awsServerlessExpressMiddleware.eventContext())

// Enable CORS for all methods
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*")
  res.header("Access-Control-Allow-Headers", "*")
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
  const condition = {}
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
    TableName: TableNames.FAQ,
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
  const params = {};
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
    TableName: TableNames.FAQ,
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
    TableName: TableNames.FAQ,
    Item: req.body
  }
  dynamodb.put(putItemParams, (err, data) => {
    if (err) {
      res.statusCode = 500;
      res.json({ error: err, url: req.url, body: req.body });
    } else{
      res.json({ success: 'put call succeed!', url: req.url, data: data })
    }
  });
});

/**
 * Handler function to search faq data.
 * endpoint: /faq/:orgId/search
 */
 app.post(path + '/:orgId/search', async (req, res) => {
  const searchOptions = pickObjectProperty(req.body, [ "offset", "limit", "sortBy", "sortOrder", "filters", "mustNotFilters" ]);
  const periodFilter = req.body.periodFilter;
  const aggregateOptions = req.body.aggregations;

   let result = {};
   if (aggregateOptions) {
     const response = await aggregateService.getAggregatedResults(req.params.orgId, searchOptions, periodFilter, aggregateOptions);
     console.log(response);
     let responseData = {};
     responseData = Object.values(response)[0];
     for (let item in responseData) {
       if (responseData[item] && responseData[item].aggs && responseData[item].aggs.faqAnswer) {
        responseData[item].instantRate =  responseData[item].aggs.faqAnswer!==0 ? Math.round(responseData[item]?.aggs?.faqAnswer * 1000/responseData[item]?.count)/10 + "%" : "0 %" ;
       }
       else{
        responseData[item].instantRate = "0"+"%";
       }
       if (response?.faqId) {
         responseData[item].proportion = Math.round(responseData[item]?.count * 1000 / response?.faqId) / 10 + "%" ?? "0%";

       }
     }
     result['data'] = responseData;
   }
   else{
    result = await searchService.getSearchResults(req.params.orgId, searchOptions, periodFilter);
  }
  res.json(result); 
});


/**
 * Handler function to fetch aggregate of faq data.
 * endpoint: /faq/:orgId/aggregate
 */
 app.post(path + '/:orgId/aggregate', async (req, res) => {
  const filterOptions = pickObjectProperty(req.body, [ "filters" ]);
  const periodFilter = req.body.periodFilter;
  const aggregateOptions = req.body.aggregations;
  let result = await aggregateService.getAggregatedResults(
    req.params.orgId, filterOptions, periodFilter, aggregateOptions
  );
  console.log(result);
  res.json(result);
});


/**
 * Handler function to fetch getUserFeedbackSummary.
 * endpoint: /faq/:orgId/getUserFeedbackSummary
 */
app.post(path + '/:orgId/getFaqFeedbackSummary', async (req, res) => {

  // Retrieve path params.
  console.log("inside getUserFeedbackSummary endpoint");
  const aggregateOptions = req.body.aggregations;
  const filterOptions = pickObjectProperty(req.body, ["filters"]);
  const periodFilter = req.body.periodFilter;

  let result = await aggregateService.getAggregatedResults(
    req.params.orgId, filterOptions, periodFilter, aggregateOptions
  );

  let helpfulCount = result.userVote?.find(item => item?.label === 'Yes')?.count ?? 0;
  let notHelpfulCount = result.userVote?.find(item => item?.label === 'No')?.count ?? 0;
  let ignoredCount = result.faqAnswer - (helpfulCount + notHelpfulCount);

  const response = {
    totalQueries: result?.faqId ?? 0,
    helpfulCount: helpfulCount !== 0 ? helpfulCount + " (" + Math.round(helpfulCount * 1000 / result.faqId) / 10 + "%)" : 0,
    notHelpfulCount: notHelpfulCount !== 0 ? notHelpfulCount + " (" + Math.round(notHelpfulCount * 1000 / result.faqId) / 10 + "%)" : 0,
    ignoredCount: ignoredCount !== 0 ? ignoredCount + " (" + Math.round(ignoredCount * 1000 / result.faqId) / 10 + "%)" : 0,
    totalAnsweredQueries : result?.faqAnswer ?? 0,
    instantAnswerRate : result?.faqAnswer!==0 ? Math.round(result?.faqAnswer*1000/result?.faqId)/10 + " %" : "0%" ,
    zeroSearchResultsRate : (result?.faqId - result?.faqAnswer)!==0 ? Math.round((result?.faqId - result?.faqAnswer)*1000/ result?.faqId)/10+ " %" : "0%" 
  }

  res.json(response);
});
/**
 * Handler function to fetch getNegativeUserResponses.
 * endpoint: /faq/:orgId/getNegativeUserResponses
 */
 app.post(path + '/:orgId/getNegativeUserResponses', async (req, res) => {

  // Retrieve path params.
  console.log("inside getNegativeUserResponses endpoint");
  const { orgId } = req.params;
  const { dateRange } = req.body ? req.body : undefined;

  console.log("attr",orgId,dateRange);
  const response = await services.getNegativeUserResponses(orgId,dateRange);
  res.statusCode = response.statusCode;
  res.json(response);
});


/************************************
* HTTP post method for insert object *
*************************************/

app.post(path, function(req, res) {

  if (userIdPresent) {
    req.body['userId'] = req.apiGateway.event.requestContext.identity.cognitoIdentityId || UNAUTH;
  }

  let putItemParams = {
    TableName: TableNames.FAQ,
    Item: req.body
  }
  dynamodb.put(putItemParams, (err, data) => {
    if (err) {
      res.statusCode = 500;
      res.json({error: err, url: req.url, body: req.body});
    } else {
      res.json({success: 'post call succeed!', url: req.url, data: data})
    }
  });
});

/**************************************
* HTTP remove method to delete object *
***************************************/

app.delete(path + '/object' + hashKeyPath + sortKeyPath, function(req, res) {
  const params = {};
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
    TableName: TableNames.FAQ,
    Key: params
  }
  dynamodb.delete(removeItemParams, (err, data)=> {
    if (err) {
      res.statusCode = 500;
      res.json({error: err, url: req.url});
    } else {
      res.json({url: req.url, data: data});
    }
  });
});

app.listen(3000, function() {
  console.log("App started")
});

// Export the app object. When executing the application local this does nothing. However,
// to port it to AWS Lambda we will create a wrapper around that will load the app from
// this file
module.exports = app;