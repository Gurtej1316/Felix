const {
  getSearchQuery, getUniqueValuesQuery,
  getUniqueValuesFromResponse
} = require("@commonutils/search");
const { Entities } = require("@commonmodels/elastic");
const { GetElasticClient, ElasticIndices, getElasticHits } = require('@searchutils/models');

/**
 * Service function which holds business logic to fetch unique values of each campaign table fields.
 */
const getPropertyUniqueValues = async (orgId, properties) => {
  const aggregateQuery =  getUniqueValuesQuery(Entities.workflows, properties);
  console.log(aggregateQuery);
  const elasticClient =await GetElasticClient();
  const elasticResponse = await elasticClient.search({
    index: ElasticIndices.workflows,
    body: {
      aggs: aggregateQuery
    }
  });
  return getUniqueValuesFromResponse(elasticResponse, properties);
};

/**
 * Service function which holds business logic to fetch paginated and filtered campaign data.
 * @param {string} orgId
 * @param {*} options
 * @returns
 */
const getSearchResults = async (orgId, options) => {
  const searchQuery = getSearchQuery(Entities.workflows, options);
  console.log('search query - ',searchQuery);
  const elasticClient =await GetElasticClient();
  const elasticResponse = await elasticClient.search({
    index: ElasticIndices.workflows,
    body: searchQuery
  });
  return getElasticHits(elasticResponse);
};

module.exports = {
  getPropertyUniqueValues,
  getSearchResults
};