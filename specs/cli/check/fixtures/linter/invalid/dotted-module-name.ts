// Invalid for node config: a dotted MODULE NAME is not an extension — it still needs .js
import { post } from './entities/dashboard.post';
import { user } from './entities/user.entity';

export const owners = [post, user];
