import { fastifyCors } from '@fastify/cors';
import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

import { APPS_JWT_SECRET } from '../../config/secrets.js';
import { APPS_PUBLISHER_ID } from '../../utils/config.js';
import chatController from '../chat/chatMessage.controller.js';
import graaspItemLogin from '../itemLogin/itemLogin.controller.js';
import { itemMembershipsController } from '../itemMembership/membership.controller.js';
import itemController from './item.controller.js';
import actionItemPlugin from './plugins/action/itemAction.controller.js';
import graaspApps from './plugins/app/app.controller.js';
import { plugin as graaspAppItem } from './plugins/app/appItem.controller.js';
import { capsulePlugin } from './plugins/capsule/capsule.controller.js';
import graaspDocumentItem from './plugins/document/document.controller.js';
import { PREFIX_DOCUMENT } from './plugins/document/document.service.js';
import graaspEmbeddedLinkItem from './plugins/embeddedLink/link.controller.js';
import { PREFIX_EMBEDDED_LINK } from './plugins/embeddedLink/link.service.js';
import graaspEnrollPlugin from './plugins/enroll/enroll.controller.js';
import graaspEtherpadPlugin from './plugins/etherpad/etherpad.controller.js';
import graaspFileItem from './plugins/file/itemFile.controller.js';
import graaspFolderItem from './plugins/folder/folder.controller.js';
import itemGeolocationPlugin from './plugins/geolocation/itemGeolocation.controller.js';
import graaspH5PPlugin from './plugins/html/h5p/h5p.controller.js';
import graaspImportExportPlugin from './plugins/importExport/importExport.controller.js';
import graaspInvitationsPlugin from './plugins/invitation/invitation.controller.js';
import graaspFavoritePlugin from './plugins/itemBookmark/itemBookmark.controller.js';
import graaspItemFlags from './plugins/itemFlag/itemFlag.controller.js';
import graaspItemLikes from './plugins/itemLike/itemLike.controller.js';
import graaspItemVisibility from './plugins/itemVisibility/itemVisibility.controller.js';
import { pageItemPlugin } from './plugins/page/page.controller.js';
import graaspItemPublicationState from './plugins/publication/publicationState/publication.controller.js';
import graaspItemPublish from './plugins/publication/published/itemPublished.controller.js';
import graaspValidationPlugin from './plugins/publication/validation/itemValidation.controller.js';
import graaspRecycledItemData from './plugins/recycled/recycled.controller.js';
import ShortLinkService from './plugins/shortLink/shortlink.controller.js';
import { SHORT_LINKS_ROUTE_PREFIX } from './plugins/shortLink/shortlink.service.js';
import { plugin as graaspShortcutPlugin } from './plugins/shortcut/shortcut.controller.js';
import graaspItemTagPlugin from './plugins/tag/itemTag.controller.js';
import thumbnailsPlugin from './plugins/thumbnail/itemThumbnail.controller.js';
import { itemWsHooks } from './ws/item.hooks.js';

const plugin: FastifyPluginAsync = async (fastify) => {
  // this needs to execute before 'create()' and 'updateOne()' are called
  // because graaspApps extends the schemas
  await fastify.register(graaspApps, {
    jwtSecret: APPS_JWT_SECRET,
    prefix: '/app-items',
    publisherId: APPS_PUBLISHER_ID,
  });

  await fastify.register(
    async function (fastify) {
      // add CORS support
      if (fastify.corsPluginOptions) {
        fastify.register(fastifyCors, fastify.corsPluginOptions);
      }

      // plugins that don't require authentication
      fastify.register(graaspItemLogin);

      fastify.register(graaspFavoritePlugin);

      fastify.register(graaspItemPublish);

      fastify.register(itemMembershipsController);

      fastify.register(graaspShortcutPlugin);

      fastify.register(thumbnailsPlugin);

      fastify.register(graaspFileItem, {});

      fastify.register(graaspItemVisibility);

      fastify.register(graaspFolderItem);

      fastify.register(capsulePlugin);

      fastify.register(graaspAppItem);

      fastify.register(ShortLinkService, {
        prefix: SHORT_LINKS_ROUTE_PREFIX,
      });

      fastify.register(graaspItemPublicationState);

      // core routes - require authentication
      fastify.register(async function (fastify) {
        fastify.register(itemWsHooks);

        // H5P plugin must be registered before ZIP
        fastify.register(graaspH5PPlugin);

        fastify.register(graaspEtherpadPlugin);

        fastify.register(graaspImportExportPlugin);

        fastify.register(graaspEmbeddedLinkItem, {
          prefix: PREFIX_EMBEDDED_LINK,
        });

        fastify.register(graaspDocumentItem, { prefix: PREFIX_DOCUMENT });

        fastify.register(graaspInvitationsPlugin);

        fastify.register(graaspEnrollPlugin);

        fastify.register(graaspItemFlags);

        fastify.register(graaspRecycledItemData);

        fastify.register(graaspValidationPlugin);

        fastify.register(graaspItemLikes);

        fastify.register(fp(chatController));

        fastify.register(actionItemPlugin);

        fastify.register(itemGeolocationPlugin);

        fastify.register(graaspItemTagPlugin);

        fastify.register(pageItemPlugin);

        fastify.register(itemController);
      });
    },
    { prefix: '/items' },
  );
};

export default plugin;
