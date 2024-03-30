const {
  getSearchQuery, getUniqueValuesQuery,
  getUniqueValuesFromResponse
} = require("@commonutils/search");
const { Entities } = require("@commonmodels/elastic");
const { GetElasticClient, ElasticIndices, getElasticHits } = require('@searchutils/models');

/**
 * Service function which holds business logic to fetch unique values of each Conversation  schema fields.
 */
const getPropertyUniqueValues = async (orgId, properties) => {
  const aggregateQuery = getUniqueValuesQuery(Entities.conversations, properties);
  console.log(aggregateQuery);
  const elasticClient = await GetElasticClient();
  const elasticResponse = await elasticClient.search({
    index: ElasticIndices.conversations,
    body: {
      query: {
        "bool": {
          "must": [{
            "match": {
              "PK.keyword": orgId
            }
          }]
        }
      },
      aggs: aggregateQuery
    }
  });
  return getUniqueValuesFromResponse(elasticResponse, properties);
};

/**
 * Service function which holds business logic to fetch paginated and filtered Conversation  data.
 * @param {string} orgId
 * @param {*} options
 * @returns
 */
const getSearchResults = async (orgId, options) => {
  const searchQuery = getSearchQuery(Entities.conversations, options);
  searchQuery.size=1000;
  console.log('search query - ',searchQuery);
  const elasticClient =await GetElasticClient();
  const elasticResponse = await elasticClient.search({
    index: ElasticIndices.conversations,
    body: searchQuery
  });
  console.log("elasticResponse - ", getElasticHits(elasticResponse));
  return getElasticHits(elasticResponse);
};

/**
 * Service function which holds business logic to fetch paginated and filtered Conversation  data.
 * @param {string} orgId
 * @param {*} options
 * @returns
 */
const getPatternDetails = async ( searchOptions) => {

  const searchQuery = getSearchQuery(Entities.patterns, searchOptions);
  searchQuery.size=1000;
  const elasticClient =await GetElasticClient();
  const elasticResponse = await elasticClient.search({
    index: ElasticIndices.patterns,
    body: searchQuery
  });
  console.log("elasticResponse - ", getElasticHits(elasticResponse));
  return getElasticHits(elasticResponse);
};

module.exports = {
  getPropertyUniqueValues,
  getSearchResults,
  getPatternDetails
};