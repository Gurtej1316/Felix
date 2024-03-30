/*
Copyright 2017 - 2017 Amazon.com, Inc. or its affiliates. All Rights Reserved.
Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with the License. A copy of the License is located at
    http://aws.amazon.com/apache2.0/
or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and limitations under the License.
*/

/* Amplify Params - DO NOT EDIT
  ENV
  REGION
  STORAGE_ORGEVENT_ARN
  STORAGE_ORGEVENT_NAME
  STORAGE_ORGEVENT_STREAMARN
  STORAGE_ORG_ARN
  STORAGE_ORG_NAME
  STORAGE_ORG_STREAMARN
Amplify Params - DO NOT EDIT */

const AWS = require('aws-sdk')
var awsServerlessExpressMiddleware = require('aws-serverless-express/middleware')
var bodyParser = require('body-parser')
var express = require('express')
AWS.config.update({ region: process.env.TABLE_REGION });
const dynamodb = new AWS.DynamoDB.DocumentClient();
const { v4: uuidv4 } = require('uuid');

const searchServiceEvent = require('@searchutils/events');

let eventTableName = "OrgEvent";
let OrgTableName = "Org";
if (process.env.ENV && process.env.ENV !== "NONE") {
  eventTableName = eventTableName + '-' + process.env.ENV;
  OrgTableName = OrgTableName + '-' + process.env.ENV;
}

const userIdPresent = false; // TODO: update in case is required to use that definition
const partitionKeyName = "orgId";
const partitionKeyType = "S";
const sortKeyName = "eventId";
const sortKeyType = "S";
const hasSortKey = sortKeyName !== "";
const path = "/event";
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

/********************************
 * HTTP Get method for list objects *
 ********************************/

app.get(path + hashKeyPath, async function (req, res) {
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

  try {
    const orgData = await fetchOrgDetails(convertUrlType(req.params[partitionKeyName], partitionKeyType));
    const phaseData = await fetchAllPhases(convertUrlType(req.params[partitionKeyName], partitionKeyType));
    const momentsData = await fetchAllMoments(convertUrlType(req.params[partitionKeyName], partitionKeyType));

    let tempMap = new Map();
    //add all categories in the map, initiated with an empty array
    for (const category of orgData.lifecyclePhases) {
      tempMap.set(category, []);
    }
    // console.log("Temp Map",tempMap);

    for (const eventObj of momentsData) {
      let parentPhaseName = await getParentPhaseForMoment(eventObj, phaseData);

      if (tempMap.has(parentPhaseName)) {
        let tempArr = tempMap.get(parentPhaseName);
        tempArr.push(eventObj);
        tempMap.set(parentPhaseName, tempArr);
      }
    }
    console.log("Map after adding events:", tempMap);

    let finalReturnArray = [];
    //converting the Map into the required format
    for (const [key, value] of tempMap.entries()) {
      // console.log("Map Entries: ",key, value);
      let tempJSON = {};
      tempJSON.name = key;
      tempJSON.eventList = value;

      for (const tempObj of phaseData) {
        if (key === tempObj.eventName) {
          tempJSON.id = tempObj.eventId
        }
      }
      // console.log("TempJSON: ",tempJSON);
      finalReturnArray.push(tempJSON);
    }
    console.log("Final Array:", finalReturnArray);
    res.json(finalReturnArray);

  } catch (err) {
    res.statusCode = 500;
    res.json({ error: 'Could not load items: ' + err });
  }

});
/********************************
 * HTTP Get method for list objects *
 ********************************/

app.get(path + "/moments" + hashKeyPath, async function (req, res) {
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

  try {
    const momentsData = await fetchAllMoments(convertUrlType(req.params[partitionKeyName], partitionKeyType));
    console.log("Final momentsData:", momentsData);
    res.json(momentsData);

  } catch (err) {
    res.statusCode = 500;
    res.json({ error: 'Could not load momentsData: ' + err });
  }

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
    TableName: eventTableName,
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
    TableName: eventTableName,
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
    TableName: eventTableName,
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
    TableName: eventTableName,
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

app.listen(3000, function () {
  console.log("App started");
});

/*
* Dynamically update data of all moments
*/
async function populatePhaseAttributes(phaseData) {
  for (const tempObj of phaseData) {
    //update patterns, promoters, detractors, passive, trend, sentimentScore, noOfEmployees / noOfCampaigns, updatedDate
    //TODO - write code and logic once design is ready to update these dynamically from querying relevant tables
    tempObj.patterns = {};
    tempObj.patterns.negative = [];
    tempObj.patterns.positive = [];
    tempObj.promoters = 1;
    tempObj.detractors = 1;
    tempObj.passive = 1;
    tempObj.trend = 1;
    tempObj.sentimentScore = 4.5;
    tempObj.noOfEmployees = 10;
    tempObj.updatedDate = new Date().toISOString();
  }

  return phaseData;
}


/*
* Return phase name for a given moment
*/
async function getParentPhaseForMoment(momentObj, phaseDetailsArray) {
  for (const phaseObj of phaseDetailsArray) {
    if (momentObj.parentEventId === phaseObj.eventId) {
      return phaseObj.eventName;
    }
  }
  return null;
}

/*
* Return All phases for an Org
*/
async function fetchAllPhases(orgId) {
  console.log("Inside fetchAllMoments() - START");

  let searchCond = [
    {
      match: {
        "eventType": "phase"
      }
    },
    {
      match: {
        "orgId": orgId
      }
    }
  ];

  let eventData = await searchServiceEvent.getFilteredEvents(orgId, searchCond);
  console.log("Inside fetchAllMoments() - Printing eventData", eventData);
  return eventData;
}

/*
* Return All Events for an Org
*/
async function fetchAllMoments(orgId) {
  console.log("Inside fetchAllMoments() - START");

  let searchCond = [
    {
      match: {
        "eventType": "moment"
      }
    },
    {
      match: {
        "orgId": orgId
      }
    }
  ];

  let eventData = await searchServiceEvent.getFilteredEvents(orgId, searchCond);
  console.log("Inside fetchAllMoments() - Printing eventData", eventData);
  await populatePhaseAttributes(eventData);
  return eventData;
}

/*
* Return Org Details
*/
async function fetchOrgDetails(orgId) {

  console.log("Inside fetchAllMoments() - START");
  let queryParams = {
    TableName: OrgTableName,
    Key: {
      "orgId": orgId
    }
  };

  //there will only be one orgData returned always
  let orgData = await dynamodb.get(queryParams).promise();
  orgData = orgData.Item;

  //check on lifecyclePhases attribute existence
  if (!orgData.lifecyclePhases || orgData.lifecyclePhases.length === 0) {
    let tempArr = ["Onboarding", "Early Employee", "Tenured Employee", "Alumni"];

    //update back into DB
    queryParams = {
      TableName: OrgTableName,
      Key: {
        "orgId": orgId
      },
      UpdateExpression: "SET lifecyclePhases = :lifecyclePhases",
      ExpressionAttributeValues: {
        ":lifecyclePhases": tempArr
      }
    };
    await dynamodb.update(queryParams).promise();


    //adding an event row for each phase to the OrgEvent table
    for (const phaseName of tempArr) {
      let item = {
        "orgId": orgId,
        "eventId": uuidv4(),
        "eventName": phaseName,
        "eventType": "phase",
        "parentEventId": "MASTER",
        "createdDate": new Date().toISOString(),
        "updatedDate": new Date().toISOString()
      };
      try {
        let putItemParams = {
          TableName: eventTableName,
          Item: item
        };
        await dynamodb.put(putItemParams).promise();
        console.log("Inside fetchOrgDetails() - Phase Item on the way to getting saved ", item);
      } catch (error) {
        console.error(error);
      }
    }

  }

  console.log("Inside fetchOrgDetails() - Printing orgData", orgData);
  return orgData;
}

// Export the app object. When executing the application local this does nothing. However,
// to port it to AWS Lambda we will create a wrapper around that will load the app from
// this file
module.exports = app;
