import { Controller, OnStart } from "@flamework/core";
import { Players, Workspace, UserInputService, ReplicatedStorage, TweenService, RunService } from "@rbxts/services";
import { GridSize } from "shared/Buildata";

const player = Players.LocalPlayer;
const camera = Workspace.CurrentCamera!;
const mouse = player.GetMouse();
const playergui = player.WaitForChild("PlayerGui") as PlayerGui;

const placeBlockEvent = ReplicatedStorage.WaitForChild("PlaceBlock") as RemoteEvent;
const deleteBlockEvent = ReplicatedStorage.WaitForChild("DeleteBlock") as RemoteEvent;

const BlockFolder = Workspace.WaitForChild("PlacedBlocks") as Folder;

const buildmodeui = playergui.WaitForChild("BuildModeUI") as ScreenGui;
const BuildLabel = buildmodeui.WaitForChild("BuildMode") as TextLabel;
const DeleteButton = buildmodeui.WaitForChild("Delete") as TextButton;
const rotateButton = buildmodeui.WaitForChild("Rotate") as TextButton;

const PREVIEW_COLOR = new BrickColor("Bright blue");
const DELETE_COLOR = new BrickColor("Bright red");
const MAX_REACH = 50;

const BUTTON_ACTIVE_SIZE = new UDim2(0, 220, 0, 55);
const BUTTON_INACTIVE_SIZE = new UDim2(0, 200, 0, 50);
const LABEL_POSITION_IN = new UDim2(0.415, 0, 0.824, 0);
const LABEL_POSITION_OUT = new UDim2(0.415, 0, 1, 0);
const DELETE_POSITION_IN = new UDim2(0.589, 0, 0.926, 0);
const DELETE_POSITION_OUT = new UDim2(0.589, 0, 1, 0);
const ROTATE_POSITION_IN = new UDim2(0.257, 0, 0.926, 0);
const ROTATE_POSITION_OUT = new UDim2(0.257, 0, 1, 0);

const tweenFast = new TweenInfo(0.2, Enum.EasingStyle.Quad, Enum.EasingDirection.Out);
const tweenSlow = new TweenInfo(0.4, Enum.EasingStyle.Quad, Enum.EasingDirection.Out);


// tweens

const Tweens = {
	labelIn: TweenService.Create(BuildLabel, tweenFast, { Position: LABEL_POSITION_IN }),
	labelOut: TweenService.Create(BuildLabel, tweenFast, { Position: LABEL_POSITION_OUT }),
	deleteIn: TweenService.Create(DeleteButton, tweenSlow, { Position: DELETE_POSITION_IN }),
	deleteOut: TweenService.Create(DeleteButton, tweenSlow, { Position: DELETE_POSITION_OUT }),
	rotateIn: TweenService.Create(rotateButton, tweenSlow, { Position: ROTATE_POSITION_IN }),
	rotateOut: TweenService.Create(rotateButton, tweenSlow, { Position: ROTATE_POSITION_OUT }),
	deleteGrow: TweenService.Create(DeleteButton, tweenFast, { Size: BUTTON_ACTIVE_SIZE }),
	deleteShrink: TweenService.Create(DeleteButton, tweenFast, { Size: BUTTON_INACTIVE_SIZE }),
	rotateGrow: TweenService.Create(rotateButton, tweenFast, { Size: BUTTON_ACTIVE_SIZE }),
	rotateShrink: TweenService.Create(rotateButton, tweenFast, { Size: BUTTON_INACTIVE_SIZE }),
};

let buildMode = false;
let deleteMode = false;
let currentRotation = 0;
let lastHovered: BasePart | undefined;
let isHoldingMouse = false;

function tweenIn() {
	Tweens.deleteIn.Play();
	Tweens.rotateIn.Play();
	Tweens.labelIn.Play();
}

function tweenOut() {
	Tweens.deleteOut.Play();
	Tweens.rotateOut.Play();
	Tweens.labelOut.Play();
}

function setDeleteMode(value: boolean, preview: Part) {
	deleteMode = value;
	preview.Transparency = deleteMode ? 1 : 0.5;
	preview.BrickColor = deleteMode ? DELETE_COLOR : PREVIEW_COLOR;

	if (deleteMode) {
		Tweens.deleteGrow.Play();
	} else {
		Tweens.deleteShrink.Play();
	}
}

// grid snapping function 

export function snapToGrid(position: Vector3): Vector3 {
	return new Vector3(
		math.round(position.X / GridSize) * GridSize + GridSize / 2,
		math.round(position.Y / GridSize) * GridSize + GridSize / 2,
		math.round(position.Z / GridSize) * GridSize + GridSize / 2,
	);
}

// sends a raycast to the mouse and returns what it touched

function getRaycastResult(preview: Part): RaycastResult | undefined {
	const unitRay = camera.ScreenPointToRay(mouse.X, mouse.Y);
	const raycastParams = new RaycastParams();
	raycastParams.FilterDescendantsInstances = [preview];
	raycastParams.FilterType = Enum.RaycastFilterType.Exclude;
	return Workspace.Raycast(unitRay.Origin, unitRay.Direction.mul(MAX_REACH), raycastParams) ?? undefined;
}

// preview block

function createPreview(): Part {
	const preview = new Instance("Part");
	preview.Anchored = true;
	preview.CanCollide = false;
	preview.CastShadow = false;
	preview.Transparency = 1;
	preview.Size = new Vector3(GridSize, GridSize, GridSize);
	preview.BrickColor = PREVIEW_COLOR;
	preview.Parent = Workspace;
	preview.Name = "BuildPreview";
	return preview;
}

// flamework controller 

@Controller()
export class BuildController implements OnStart {
	onStart() {
		const preview = createPreview();

		DeleteButton.Activated.Connect(() => {
			setDeleteMode(!deleteMode, preview);
		});

		rotateButton.Activated.Connect(() => {
			currentRotation = (currentRotation + 90) % 360;
		});

		UserInputService.InputBegan.Connect((input, gameProcessed) => {
			if (input.KeyCode === Enum.KeyCode.Tab) {
				buildMode = !buildMode;
				deleteMode = false;
				preview.Transparency = buildMode ? 0.5 : 1;

				if (buildMode) {
					tweenIn();
				} else {
					tweenOut();
				}
			}

			if (!buildMode) return;

			if (input.KeyCode === Enum.KeyCode.R) {
				currentRotation = (currentRotation + 90) % 360; // allows a rotation of up to 360 degrees and then start over at 0 again
			}

			if (input.KeyCode === Enum.KeyCode.F) {
				setDeleteMode(!deleteMode, preview);
			}

			if (!gameProcessed && input.UserInputType === Enum.UserInputType.MouseButton1) {
				isHoldingMouse = true;
				const result = getRaycastResult(preview);
				if (!result) return;

				if (deleteMode) {
					const hit = result.Instance;
					if (hit && hit.IsA("BasePart")) {
						deleteBlockEvent.FireServer(hit);
					}
				} else {
					placeBlockEvent.FireServer(snapToGrid(result.Position), currentRotation);
				}
			}
		});

		UserInputService.InputEnded.Connect((input) => {
			if (input.UserInputType === Enum.UserInputType.MouseButton1) {
				isHoldingMouse = false;
			}
		});

		RunService.RenderStepped.Connect(() => {
			if (!buildMode) return;

			const result = getRaycastResult(preview);

			if (lastHovered) {
				lastHovered.BrickColor = new BrickColor("Medium stone grey");
				lastHovered.Transparency = 0;
				lastHovered = undefined;
			}

			if (result) {
				if (deleteMode) {
					preview.Transparency = 1;

					const hit = result.Instance;
					if (hit && hit.IsA("BasePart") && hit.Parent === BlockFolder) {
						hit.BrickColor = new BrickColor("Bright red");
						hit.Transparency = 0.5;
						lastHovered = hit;

						if (isHoldingMouse) {
							// (allows holding mouse button 1 to delete blocks)
							deleteBlockEvent.FireServer(hit);
							lastHovered = undefined;
						}
					}
					return;
				}

				const snapped = snapToGrid(result.Position);
				preview.Transparency = 0.5;
				preview.CFrame = new CFrame(snapped).mul(CFrame.Angles(0, math.rad(currentRotation), 0));
				

				if (isHoldingMouse) {
					// (allows holding mouse button 1 to build)
					placeBlockEvent.FireServer(snapped, currentRotation);
				}
			} else {
				preview.Transparency = 1;
			}
		});
	}
}
