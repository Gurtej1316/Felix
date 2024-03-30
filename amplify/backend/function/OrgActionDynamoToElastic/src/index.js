/* Amplify Params - DO NOT EDIT
	ENV
	REGION
	STORAGE_ORGUSER_ARN
	STORAGE_ORGUSER_NAME
	STORAGE_ORGUSER_STREAMARN
	STORAGE_ORG_ARN
	STORAGE_ORG_NAME
	STORAGE_ORG_STREAMARN
Amplify Params - DO NOT EDIT */
const axios = require('axios');
const AWS = require('aws-sdk');
const dbUtils = require('@dbutils/services');
const utilityFunctions = require('./utility-functions');

// DynamoDB Configurations
const orgIdName = 'orgId';
const recordIdName = 'actionId';
const {ElasticClusterConfig, ElasticIndices,ElasticIndexTypes} = require('@searchutils/models');

exports.handler = async (event, context) => {
    const ElasticClusterConfigData= await ElasticClusterConfig;

    const url = `${ElasticClusterConfigData.node}/${ElasticIndices.actions}/${ElasticIndexTypes.actions}/`;

    let count = 0;
    for (const record of event.Records) {
        const id = encodeURIComponent(record.dynamodb.Keys[orgIdName].S+"-"+record.dynamodb.Keys[recordIdName].S);
        try {
            if (record.eventName == 'REMOVE') {
                await axios.delete(url + id, { auth: ElasticClusterConfigData.auth });
                return 'Item removed'
            }
            else {
                const document = AWS.DynamoDB.Converter.unmarshall(record.dynamodb.NewImage);
                console.log('Adding document - printing record and document',record,document);

                //if the owner is from the list of managers, then we will have the ownerCommId to add user attributes to the index
                if(document.ownerCommId){
                    //first fetch userDetails
                    let searchCond = [
                        { match: { "commId": document.ownerCommId } }
                    ];
                    let userData = await getFilteredEmployees(document.orgId,searchCond);
                    userData = userData && userData[0] ? userData[0] : undefined; //setting userData[0] to userData for better readability for the rest of the code
                
                    if(userData){
                        let userDetailsToSave = await dbUtils.fetchListofUserAttributesToSave(document.orgId,userData);
                        if(userDetailsToSave){
                            for(const [key,value] of Object.entries(userDetailsToSave)){
                                document[key] = value;
                            }
                        }
                    }
                }

                let a = await axios.put(url + id, document, { auth: ElasticClusterConfigData.auth })
                // console.log(a);


                if((record.eventName === 'INSERT' || (record.eventName === 'MODIFY' && document.progress === 100)) && document.associatedPatterns !== undefined){
                    //case when a new Action record is being inserted into the index OR existing Action updated with progress 100
                    let listOfUserIds = await utilityFunctions.fetchUserIdsFromListOfPatterns(document.associatedPatterns);
                    let listOfCommIds = await utilityFunctions.fetchCommIdsForListOfUserIds(listOfUserIds);
                    // console.log("List of Comm Ids",listOfCommIds);
                    await utilityFunctions.sendPingToListOfUsers(document.orgId,record.eventName,document.owner,document.summary,document.associatedPatterns,listOfCommIds);
                }
            }
        } catch (error) {
            console.error(error);
            console.log('Failed to update a record in Elastic');
            console.log('Continuing with other records');
        }
        count += 1;
    }
    return `Successfully processed ${count} records.`;
};