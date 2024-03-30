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
const recordIdName = 'faqId';
const { fetchListofUserAttributesToSave } = require('@dbutils/services');
const {ElasticClusterConfig, ElasticIndices,ElasticIndexTypes} = require('@searchutils/models');
const { fetchUserFromDB } = require('@dbutils/user');

exports.handler = async (event, context) => {
    const ElasticClusterConfigData= await ElasticClusterConfig;

    const url = `${ElasticClusterConfigData.node}/${ElasticIndices.faq}/${ElasticIndexTypes.faq}/`;

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

                if(document.userId){
                    //fetch userData
                    let userData = await fetchUserFromDB(document.orgId,document.userId);
                    if(userData){
                        let userDetailsToSave = await fetchListofUserAttributesToSave(document.orgId,userData);
                        if(userDetailsToSave){
                            for(const [key,value] of Object.entries(userDetailsToSave)){
                                document[key] = value;
                            }
                        }
                    }
                    // console.log("modified document",document);
                }

                await axios.put(url + id, document, { auth: ElasticClusterConfigData.auth })
                // console.log(a);
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