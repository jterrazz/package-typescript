// Valid file: a dotted module name carrying its .js extension satisfies the node config
import { post } from './entities/dashboard.post.js';
import { user } from './entities/user.entity.js';

export const owners = [post, user];
