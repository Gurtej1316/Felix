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

// DynamoDB Configurations
const orgIdName = 'orgId';
const recordIdName = 'userId';

const {ElasticClusterConfig, ElasticIndices,ElasticIndexTypes} = require('@searchutils/models');
const { fetchUserFromDB } = require('@dbutils/user');
 const { updateCommIdForUsers } = require('@communicationutils/slackServices');

exports.handler = async (event, context) => {
    const ElasticClusterConfigData= await ElasticClusterConfig;

    const url = `${ElasticClusterConfigData.node}/${ElasticIndices.employees}/${ElasticIndexTypes.employees}/`;

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
                console.log('Adding document');
                console.log(document);
                if(document.managerId){
                    //if Manager ID is present, then push manager name and email as well to the index
                    let managerDetail = await fetchUserFromDB(document.orgId,document.managerId);
                    // console.log("managerDetail",managerDetail);

                    //add to document
                    //TODO - null checks
                    if(managerDetail){
                        document['managerEmail'] = managerDetail.userEmail;
                        document['managerName'] = managerDetail.firstName + (managerDetail.lastName? " " + managerDetail.lastName : "");
                    }
                }

                if(record.eventName === 'INSERT'){
                    console.log("inside INSERT");
                    if(document && document.userEmail && document.commChannel 
                        && document.commChannel === "Slack" && !document.commId){
                            //new users where email exists, commChannel is Slack and commId doesn't exist
                            console.log("inside inside if");
                            let emailList=[];
                            emailList.push(document.userEmail);
                            await updateCommIdForUsers(document.orgId,emailList);
                        }
                }

                let a = await axios.put(url + id, document, { auth: ElasticClusterConfigData.auth })
                console.log(a);
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
