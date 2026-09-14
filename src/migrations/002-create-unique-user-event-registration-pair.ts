import { QueryInterface } from 'sequelize';

interface MigrationContext {
  context: QueryInterface;
}

export async function up({ context: queryInterface }: MigrationContext) {
  
  await queryInterface.addConstraint('registrations', {
    fields: ['event_id', 'user_id'],
    type: 'unique',
    name: 'registrations_event_id_user_id_unique',
  });

}

export async function down({ context: queryInterface }: MigrationContext) {
await queryInterface.removeConstraint(
    'registrations',
    'registrations_event_id_user_id_unique',
  );
}
