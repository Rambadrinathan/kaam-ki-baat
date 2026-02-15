-- Create Paritosh's Team
INSERT INTO teams (name, description, created_by_user_id, full_score_value)
VALUES ('Paritosh Team', 'Demo team managed by Paritosh', '9ce9d6da-15b0-487a-89a4-730a4ca1d732', 500);

-- Add Paritosh as captain
INSERT INTO team_memberships (team_id, user_id, role, status)
SELECT t.id, '9ce9d6da-15b0-487a-89a4-730a4ca1d732', 'captain', 'active'
FROM teams t WHERE t.name = 'Paritosh Team';

-- Add Ram, Arup, Manoranja as members
INSERT INTO team_memberships (team_id, user_id, role, status)
SELECT t.id, '994684aa-eea1-43ff-8dc3-f592d53b4942', 'member', 'active'
FROM teams t WHERE t.name = 'Paritosh Team';

INSERT INTO team_memberships (team_id, user_id, role, status)
SELECT t.id, '9a7db17b-0e67-4809-a73c-146678e04f0d', 'member', 'active'
FROM teams t WHERE t.name = 'Paritosh Team';

INSERT INTO team_memberships (team_id, user_id, role, status)
SELECT t.id, '9d9ed4db-447e-4cf4-9490-91d0df977c0b', 'member', 'active'
FROM teams t WHERE t.name = 'Paritosh Team';

-- Grant admin role to master admin
INSERT INTO user_roles (user_id, role)
VALUES ('9ef844f0-4143-4d9f-948c-a92d15030599', 'admin');