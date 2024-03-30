const { getSearchQuery } = require("@commonutils/search");
const { Entities } = require("@commonmodels/elastic");
const { ElasticIndices, scrollElastic } = require('@searchutils/models');
const { uploadDoctoS3, S3Prefix } = require("@commonutils/s3");
const { convertToCSV } = require("@commonutils/csvConverter");
const { S3Bucket } = require('@commonutils/constants');

/**
 * Service function to format the given export data and store it to s3.
 * @param {object} data
 * @param {string} format
 */
const getExportS3FileKey = async (orgId, data, format) => {
  let uploadData = data ?? [];
  if(uploadData.length>0){
    uploadData = uploadData.map(({ globalInsight, orgId, insightId, localInsight,insightPriority, ...item }) => item);
  }
  const fileKey = `tmp/export/${orgId}-${Entities.insights}-${Date.now()}`;
  let fileExtension;
  if (format === "csv") {
    uploadData = await convertToCSV(uploadData);
    fileExtension = ".csv";
  } else if (format === "json") {
    uploadData = JSON.stringify(uploadData);
    fileExtension = ".json";
  }
  const resp = await uploadDoctoS3(uploadData, S3Prefix.public, `${fileKey}${fileExtension}`, S3Bucket.LISTING_DATA_EXPORT);
  return resp.key;
};


/**
 * Service function to fetch paginated and filtered insights.
 * @param {string} orgId
 * @param {*} options
 * @returns
 */
const getExportResults = async (orgId, options) => {
  const searchQuery = getSearchQuery(Entities.insights, options);
  console.log(JSON.stringify(searchQuery));
  const elasticResponse = await scrollElastic(ElasticIndices.insights, searchQuery);
  return elasticResponse;
};

module.exports = {
  getExportResults,
  getExportS3FileKey
};