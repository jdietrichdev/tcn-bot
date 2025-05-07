import {
  APIInteraction,
  APIMessageComponentInteraction,
} from "discord-api-types/v10";
import { createApplyModal } from "./apply";
import { createDenyAppModal } from "./denyApp";

export enum ModalType {
  APPLY,
  DENY_APP,
}
export const createModal = (
  interaction: APIInteraction,
  modalType: ModalType
) => {
  switch (modalType) {
    case ModalType.APPLY:
      return createApplyModal();
    case ModalType.DENY_APP:
      return createDenyAppModal(interaction as APIMessageComponentInteraction);
  }
};
