const { DynamoDBClient, CreateTableCommand, DescribeTableCommand } = require('@aws-sdk/client-dynamodb');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-west-2' });

const tables = [
  {
    TableName: 'orbit_users',
    KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
    AttributeDefinitions: [
      { AttributeName: 'id', AttributeType: 'S' },
      { AttributeName: 'email', AttributeType: 'S' },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'email-index',
        KeySchema: [{ AttributeName: 'email', KeyType: 'HASH' }],
        Projection: { ProjectionType: 'ALL' },
        BillingMode: 'PAY_PER_REQUEST',
      },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  },
  {
    TableName: 'orbit_messages',
    KeySchema: [
      { AttributeName: 'convo_key', KeyType: 'HASH' },
      { AttributeName: 'ts', KeyType: 'RANGE' },
    ],
    AttributeDefinitions: [
      { AttributeName: 'convo_key', AttributeType: 'S' },
      { AttributeName: 'ts', AttributeType: 'N' },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  },
  {
    TableName: 'orbit_groups',
    KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
    AttributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }],
    BillingMode: 'PAY_PER_REQUEST',
  },
];

async function createTables() {
  for (const table of tables) {
    try {
      await client.send(new DescribeTableCommand({ TableName: table.TableName }));
      console.log(`Table ${table.TableName} already exists, skipping.`);
    } catch (e) {
      if (e.name === 'ResourceNotFoundException') {
        const params = { ...table };
        if (params.GlobalSecondaryIndexes) {
          params.GlobalSecondaryIndexes = params.GlobalSecondaryIndexes.map(gsi => {
            const { BillingMode, ...rest } = gsi;
            return rest;
          });
        }
        await client.send(new CreateTableCommand(params));
        console.log(`Created table ${table.TableName}`);
      } else {
        throw e;
      }
    }
  }
  console.log('Done.');
}

createTables().catch(e => { console.error(e); process.exit(1); });
