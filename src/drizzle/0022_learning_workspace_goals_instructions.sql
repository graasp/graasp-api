CREATE TABLE "learning_goal_completion" (
	"goal_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "PK_learning_goal_completion" PRIMARY KEY("goal_id","account_id")
);
--> statement-breakpoint
CREATE TABLE "learning_goal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"text" varchar(200) NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "CHK_learning_goal_text" CHECK (char_length(btrim("learning_goal"."text")) BETWEEN 1 AND 200),
	CONSTRAINT "CHK_learning_goal_position" CHECK ("learning_goal"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "learning_workspace_setting" (
	"item_id" uuid PRIMARY KEY NOT NULL,
	"instructions" varchar(5000) DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learning_workspace" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"notes" varchar(20000) DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "UQ_learning_workspace_item_account" UNIQUE("item_id","account_id")
);
--> statement-breakpoint
ALTER TABLE "learning_goal_completion" ADD CONSTRAINT "FK_learning_goal_completion_goal_id" FOREIGN KEY ("goal_id") REFERENCES "public"."learning_goal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_goal_completion" ADD CONSTRAINT "FK_learning_goal_completion_account_id" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_goal" ADD CONSTRAINT "FK_learning_goal_item_id" FOREIGN KEY ("item_id") REFERENCES "public"."item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_workspace_setting" ADD CONSTRAINT "FK_learning_workspace_setting_item_id" FOREIGN KEY ("item_id") REFERENCES "public"."item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_workspace" ADD CONSTRAINT "FK_learning_workspace_item_id" FOREIGN KEY ("item_id") REFERENCES "public"."item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_workspace" ADD CONSTRAINT "FK_learning_workspace_account_id" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "IDX_learning_goal_completion_account_id" ON "learning_goal_completion" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "IDX_learning_goal_item_position" ON "learning_goal" USING btree ("item_id","position");--> statement-breakpoint
CREATE INDEX "IDX_learning_workspace_account_id" ON "learning_workspace" USING btree ("account_id");